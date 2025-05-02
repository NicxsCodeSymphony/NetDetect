from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional, Union
from pydantic import BaseModel
import mysql.connector
from mysql.connector import Error
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
import joblib
import os
from contextlib import contextmanager
import sqlalchemy

app = FastAPI(
    title="NetDetect Bandwidth Prediction API",
    description="API for predicting device bandwidth usage based on historical data",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database configuration
DB_CONFIG = {
    "host": "localhost",
    "user": "root",  # Change to your MySQL username
    "password": "goldfish123",  # Add your MySQL password
    "database": "netdetect"
}

# Define models
class BandwidthData(BaseModel):
    device_id: int
    upload: int
    download: int
    created_at: datetime

class PredictionRequest(BaseModel):
    device_id: int
    days_ahead: int = 1

class PredictionResponse(BaseModel):
    device_id: int
    predicted_upload: float
    predicted_download: float
    confidence_score: float

class BatchPredictionResponse(BaseModel):
    predictions: List[PredictionResponse]
    timestamp: datetime

# Database connection functions
def get_sqlalchemy_connection_string():
    """Create a SQLAlchemy connection string from DB_CONFIG"""
    user = DB_CONFIG['user']
    password = DB_CONFIG['password']
    host = DB_CONFIG['host']
    database = DB_CONFIG['database']
    return f"mysql+mysqlconnector://{user}:{password}@{host}/{database}"

def get_sqlalchemy_engine():
    """Create and return a SQLAlchemy engine"""
    connection_string = get_sqlalchemy_connection_string()
    return sqlalchemy.create_engine(connection_string)

@contextmanager
def get_db_connection():
    """Legacy connection manager for non-pandas operations"""
    connection = None
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        yield connection
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")
    finally:
        if connection and connection.is_connected():
            connection.close()

# Helper function to fetch device data
def get_device_data(device_id: int = None):
    """Get bandwidth data with hostname using SQLAlchemy (pandas-compatible)"""
    query = """
    SELECT 
        bandwidth.device_id, 
        networks.hostname, 
        bandwidth.upload, 
        bandwidth.download, 
        bandwidth.created_at 
    FROM bandwidth
    JOIN networks ON bandwidth.device_id = networks.id
    """
    
    if device_id:
        query += f" WHERE bandwidth.device_id = {device_id}"
    
    query += " ORDER BY bandwidth.created_at"
    
    engine = get_sqlalchemy_engine()
    return pd.read_sql(query, engine)

# Generate synthetic data for devices with insufficient data
def generate_synthetic_data(device_id: int, num_samples: int = 10):
    """Generate synthetic data for a device with insufficient real data"""
    engine = get_sqlalchemy_engine()
    
    # Try to get device type or category if available
    try:
        query = f"SELECT * FROM networks WHERE id = {device_id}"
        device_info = pd.read_sql(query, engine)
        device_category = device_info.get('category', ['unknown'])[0] if not device_info.empty else 'unknown'
    except:
        device_category = 'unknown'
    
    # Get average usage patterns from devices with data
    try:
        avg_query = """
        SELECT AVG(upload) as avg_upload, AVG(download) as avg_download 
        FROM bandwidth
        """
        avg_data = pd.read_sql(avg_query, engine)
        avg_upload = float(avg_data['avg_upload'][0]) if not avg_data.empty and not pd.isna(avg_data['avg_upload'][0]) else 10
        avg_download = float(avg_data['avg_download'][0]) if not avg_data.empty and not pd.isna(avg_data['avg_download'][0]) else 100
    except:
        avg_upload = 10  # Default if no data
        avg_download = 100  # Default if no data
    
    # Create synthetic data points
    now = datetime.now()
    data = []
    
    for i in range(num_samples):
        timestamp = now - timedelta(hours=i*6)  # Every 6 hours going backward
        
        # Add some randomness based on time of day
        hour = timestamp.hour
        time_factor = 1.5 if 9 <= hour <= 17 else 1.0  # Business hours multiplier
        
        # Random variations
        upload_variation = np.random.normal(1, 0.3)  # Mean 1, std 0.3
        download_variation = np.random.normal(1, 0.3)
        
        upload = max(0, int(avg_upload * upload_variation * time_factor))
        download = max(0, int(avg_download * download_variation * time_factor))
        
        data.append({
            "device_id": device_id,
            "upload": upload,
            "download": download,
            "created_at": timestamp,
            "is_synthetic": True  # Mark as synthetic
        })
    
    return pd.DataFrame(data)

# Feature engineering function
def engineer_features(df):
    # Convert timestamp to datetime if it's not already
    if not pd.api.types.is_datetime64_any_dtype(df['created_at']):
        df['created_at'] = pd.to_datetime(df['created_at'])
    
    # Extract time features
    df['hour'] = df['created_at'].dt.hour
    df['day'] = df['created_at'].dt.day
    df['month'] = df['created_at'].dt.month
    df['day_of_week'] = df['created_at'].dt.dayofweek
    
    # Calculate rolling statistics for each device
    features = []
    
    for device in df['device_id'].unique():
        device_df = df[df['device_id'] == device].copy()
        
        if len(device_df) > 1:  # Only calculate if we have enough data
            # Add rolling means
            device_df['upload_rolling_mean'] = device_df['upload'].rolling(window=3, min_periods=1).mean()
            device_df['download_rolling_mean'] = device_df['download'].rolling(window=3, min_periods=1).mean()
            
            # Add rolling standard deviations
            device_df['upload_rolling_std'] = device_df['upload'].rolling(window=3, min_periods=1).std().fillna(0)
            device_df['download_rolling_std'] = device_df['download'].rolling(window=3, min_periods=1).std().fillna(0)
        else:
            # If only one entry, just use the actual values
            device_df['upload_rolling_mean'] = device_df['upload']
            device_df['download_rolling_mean'] = device_df['download']
            device_df['upload_rolling_std'] = 0
            device_df['download_rolling_std'] = 0
        
        features.append(device_df)
    
    return pd.concat(features) if features else df

# Train models and save them
def train_models():
    """Train models for all devices - uses synthetic data for devices with insufficient data"""
    # Create models directory if it doesn't exist
    if not os.path.exists('models'):
        os.makedirs('models')
    
    # Get all devices from networks table
    engine = get_sqlalchemy_engine()
    networks_query = "SELECT id, hostname FROM networks ORDER BY id"
    networks_df = pd.read_sql(networks_query, engine)
    
    if networks_df.empty:
        raise HTTPException(status_code=404, detail="No devices found in networks table")
    
    # Get bandwidth data
    bandwidth_query = "SELECT * FROM bandwidth ORDER BY device_id, created_at"
    bandwidth_df = pd.read_sql(bandwidth_query, engine)
    
    # Combine real and synthetic data as needed
    all_device_data = []
    
    # Track results
    trained_count = 0
    synthetic_count = 0
    
    # Features to use
    feature_cols = ['hour', 'day', 'month', 'day_of_week', 
                   'upload_rolling_mean', 'download_rolling_mean',
                   'upload_rolling_std', 'download_rolling_std']
    
    # For each device in the networks table, attempt to train models
    for _, network_row in networks_df.iterrows():
        device_id = network_row['id']
        hostname = network_row['hostname']
        
        # Filter bandwidth data for this device
        device_data = bandwidth_df[bandwidth_df['device_id'] == device_id].copy()
        
        # Check if we have sufficient data
        if len(device_data) < 2:
            print(f"Insufficient real data for device {device_id} ({hostname}), generating synthetic data")
            
            # Generate synthetic data
            synthetic_data = generate_synthetic_data(device_id)
            
            # Combine real and synthetic data
            if len(device_data) > 0:
                device_data = pd.concat([device_data, synthetic_data])
            else:
                device_data = synthetic_data
                
            synthetic_count += 1
        
        # Engineer features
        device_features = engineer_features(device_data)
        
        # Ensure we have the necessary columns
        if len(device_features) >= 2:
            # Train upload model
            X = device_features[feature_cols].fillna(0)
            y_upload = device_features['upload']
            
            # Standardize features
            scaler_upload = StandardScaler()
            X_scaled = scaler_upload.fit_transform(X)
            
            # Train model
            model_upload = RandomForestRegressor(n_estimators=50, random_state=42)
            model_upload.fit(X_scaled, y_upload)
            
            # Save model and scaler
            joblib.dump(model_upload, f'models/upload_model_device_{device_id}.pkl')
            joblib.dump(scaler_upload, f'models/upload_scaler_device_{device_id}.pkl')
            
            # Train download model
            y_download = device_features['download']
            
            scaler_download = StandardScaler()
            X_scaled = scaler_download.fit_transform(X)
            
            model_download = RandomForestRegressor(n_estimators=50, random_state=42)
            model_download.fit(X_scaled, y_download)
            
            # Save model and scaler
            joblib.dump(model_download, f'models/download_model_device_{device_id}.pkl')
            joblib.dump(scaler_download, f'models/download_scaler_device_{device_id}.pkl')
            
            trained_count += 1
        else:
            print(f"Error: Could not train model for device {device_id} ({hostname}) - insufficient data after processing")
    
    return f"Models trained for {trained_count} devices. {synthetic_count} devices used synthetic data."

# Predict function
def predict_bandwidth(device_id: int, days_ahead: int = 1):
    """Predict bandwidth usage for a device - creates model on the fly if needed"""
    # Check if models exist
    upload_model_path = f'models/upload_model_device_{device_id}.pkl'
    download_model_path = f'models/download_model_device_{device_id}.pkl'
    
    if not (os.path.exists(upload_model_path) and os.path.exists(download_model_path)):
        # Try to train model for this specific device
        try:
            # Get device data
            engine = get_sqlalchemy_engine()
            query = f"SELECT * FROM bandwidth WHERE device_id = {device_id} ORDER BY created_at"
            device_df = pd.read_sql(query, engine)
            
            # Generate synthetic data if needed
            if len(device_df) < 2:
                synthetic_data = generate_synthetic_data(device_id)
                
                # Combine real and synthetic data
                if len(device_df) > 0:
                    device_df = pd.concat([device_df, synthetic_data])
                else:
                    device_df = synthetic_data
            
            # Engineer features
            device_features = engineer_features(device_df)
            
            # Features to use
            feature_cols = ['hour', 'day', 'month', 'day_of_week', 
                          'upload_rolling_mean', 'download_rolling_mean',
                          'upload_rolling_std', 'download_rolling_std']
            
            # Train upload model
            X = device_features[feature_cols].fillna(0)
            y_upload = device_features['upload']
            
            # Standardize features
            scaler_upload = StandardScaler()
            X_scaled = scaler_upload.fit_transform(X)
            
            # Train model
            model_upload = RandomForestRegressor(n_estimators=50, random_state=42)
            model_upload.fit(X_scaled, y_upload)
            
            # Save model and scaler
            if not os.path.exists('models'):
                os.makedirs('models')
            joblib.dump(model_upload, upload_model_path)
            joblib.dump(scaler_upload, f'models/upload_scaler_device_{device_id}.pkl')
            
            # Train download model
            y_download = device_features['download']
            
            scaler_download = StandardScaler()
            X_scaled = scaler_download.fit_transform(X)
            
            model_download = RandomForestRegressor(n_estimators=50, random_state=42)
            model_download.fit(X_scaled, y_download)
            
            # Save model and scaler
            joblib.dump(model_download, download_model_path)
            joblib.dump(scaler_download, f'models/download_scaler_device_{device_id}.pkl')
            
        except Exception as e:
            print(f"Error training model for device {device_id}: {str(e)}")
            
            # Create a fallback model using default values
            # This ensures all devices have a model
            try:
                synthetic_data = generate_synthetic_data(device_id, num_samples=300)
                device_features = engineer_features(synthetic_data)
                
                feature_cols = ['hour', 'day', 'month', 'day_of_week', 
                              'upload_rolling_mean', 'download_rolling_mean',
                              'upload_rolling_std', 'download_rolling_std']
                
                # Train fallback upload model
                X = device_features[feature_cols].fillna(0)
                y_upload = device_features['upload']
                
                scaler_upload = StandardScaler()
                X_scaled = scaler_upload.fit_transform(X)
                
                model_upload = RandomForestRegressor(n_estimators=50, random_state=42)
                model_upload.fit(X_scaled, y_upload)
                
                # Save fallback model and scaler
                if not os.path.exists('models'):
                    os.makedirs('models')
                joblib.dump(model_upload, upload_model_path)
                joblib.dump(scaler_upload, f'models/upload_scaler_device_{device_id}.pkl')
                
                # Train fallback download model
                y_download = device_features['download']
                
                scaler_download = StandardScaler()
                X_scaled = scaler_download.fit_transform(X)
                
                model_download = RandomForestRegressor(n_estimators=50, random_state=42)
                model_download.fit(X_scaled, y_download)
                
                # Save fallback model and scaler
                joblib.dump(model_download, download_model_path)
                joblib.dump(scaler_download, f'models/download_scaler_device_{device_id}.pkl')
                
                print(f"Created fallback model for device {device_id} using synthetic data")
                
            except Exception as fallback_error:
                print(f"Failed to create fallback model for device {device_id}: {str(fallback_error)}")
                return {
                    "device_id": device_id,
                    "predicted_upload": 0,
                    "predicted_download": 0,
                    "confidence_score": 0
                }
    
    # Now models should exist, but check again
    if not (os.path.exists(upload_model_path) and os.path.exists(download_model_path)):
        print(f"Warning: Models still missing for device {device_id} after attempted creation")
        return {
            "device_id": device_id,
            "predicted_upload": 0,
            "predicted_download": 0,
            "confidence_score": 0
        }
    
    try:
        # Load models and scalers
        model_upload = joblib.load(upload_model_path)
        model_download = joblib.load(download_model_path)
        scaler_upload = joblib.load(f'models/upload_scaler_device_{device_id}.pkl')
        scaler_download = joblib.load(f'models/download_scaler_device_{device_id}.pkl')
        
        # Get latest data for the device for prediction
        device_data = get_device_data(device_id)
        
        # If no real data, use synthetic
        if device_data.empty:
            print(f"No real data found for device {device_id}, using synthetic for prediction")
            synthetic_data = generate_synthetic_data(device_id, num_samples=5)
            device_data = synthetic_data
        
        # Engineer features
        device_features = engineer_features(device_data)
        
        # Get the last record
        last_record = device_features.iloc[-1]
        
        # Create prediction date (future date)
        prediction_date = last_record['created_at'] + timedelta(days=days_ahead)
        
        # Create feature row for prediction
        feature_row = {
            'created_at': prediction_date,
            'device_id': device_id,
            'upload': last_record['upload'],
            'download': last_record['download']
        }
        
        # Convert to DataFrame
        prediction_df = pd.DataFrame([feature_row])
        
        # Engineer features for prediction
        prediction_features = engineer_features(prediction_df)
        
        # Features to use
        feature_cols = ['hour', 'day', 'month', 'day_of_week', 
                       'upload_rolling_mean', 'download_rolling_mean',
                       'upload_rolling_std', 'download_rolling_std']
        
        X_pred = prediction_features[feature_cols].fillna(0)
        
        # Standardize
        X_upload_scaled = scaler_upload.transform(X_pred)
        X_download_scaled = scaler_download.transform(X_pred)
        
        # Make predictions
        upload_pred = model_upload.predict(X_upload_scaled)[0]
        download_pred = model_download.predict(X_download_scaled)[0]
        
        # Determine if the model used synthetic data
        confidence_score = 1.0
        if hasattr(model_upload, 'synthetic_data_used') and model_upload.synthetic_data_used:
            confidence_score = 0.5  # Lower confidence for synthetic data models
        
        return {
            "device_id": device_id,
            "predicted_upload": max(0, round(float(upload_pred), 2)),  # Ensure non-negative values
            "predicted_download": max(0, round(float(download_pred), 2)),
            "confidence_score": round(float(confidence_score), 2)
        }
        
    except Exception as e:
        print(f"Error making prediction for device {device_id}: {str(e)}")
        return {
            "device_id": device_id,
            "predicted_upload": 0,
            "predicted_download": 0,
            "confidence_score": 0
        }

# Routes
@app.get("/")
def read_root():
    return {"message": "Welcome to the NetDetect Bandwidth Prediction API"}

@app.post("/train")
def train_endpoint():
    """Train prediction models for all devices"""
    return {"message": train_models()}

@app.get("/devices")
def get_devices():
    """Get list of all devices with bandwidth data"""
    engine = get_sqlalchemy_engine()
    query = "SELECT DISTINCT n.id, n.hostname FROM networks n ORDER BY n.id"
    df = pd.read_sql(query, engine)
    
    if df.empty:
        return {"devices": [], "count": 0}
    
    devices = [{"id": int(row["id"]), "hostname": row["hostname"]} for _, row in df.iterrows()]
    return {"devices": devices, "count": len(devices)}

def get_device_id_by_hostname(hostname: str) -> Optional[int]:
    """Get device ID from hostname"""
    engine = get_sqlalchemy_engine()
    query = "SELECT id FROM networks WHERE hostname = %s"
    df = pd.read_sql(query, engine, params=[hostname])
    
    if df.empty:
        return None
    return int(df.iloc[0]["id"])

@app.post("/predict-host/{hostname}")
def predict_by_hostname(
    hostname: str,
    days_ahead: int = Query(1, description="Number of days to predict ahead", ge=1, le=30)
):
    """Predict bandwidth usage for a device using hostname"""
    try:
        device_id = get_device_id_by_hostname(hostname)
        if device_id is None:
            raise HTTPException(status_code=404, detail=f"No device found with hostname '{hostname}'")
        
        prediction = predict_bandwidth(device_id, days_ahead)
        prediction["hostname"] = hostname  # Include hostname in the response
        return prediction
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/{device_id}")
def predict_single_device(
    device_id: int,
    days_ahead: int = Query(1, description="Number of days to predict ahead", ge=1, le=30)
):
    """Predict bandwidth usage for a single device"""
    try:
        prediction = predict_bandwidth(device_id, days_ahead)
        
        # Get hostname
        engine = get_sqlalchemy_engine()
        query = f"SELECT hostname FROM networks WHERE id = {device_id}"
        df = pd.read_sql(query, engine)
        
        if not df.empty:
            prediction["hostname"] = df.iloc[0]["hostname"]
        
        return prediction
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/predict-all")
def predict_all_devices(
    days_ahead: int = Query(1, description="Number of days to predict ahead", ge=1, le=30)
):
    """Predict bandwidth usage for all devices"""
    try:
        # Get all devices from networks table regardless of bandwidth data
        engine = get_sqlalchemy_engine()
        query = """
        SELECT n.id as device_id, n.hostname 
        FROM networks n
        ORDER BY n.id
        """
        devices_df = pd.read_sql(query, engine)
        
        if devices_df.empty:
            raise HTTPException(status_code=404, detail="No devices found")
        
        # Make predictions for each device
        predictions = []
        for _, row in devices_df.iterrows():
            device_id = row["device_id"]
            hostname = row["hostname"]
            try:
                prediction = predict_bandwidth(device_id, days_ahead)
                # Add hostname to the prediction result
                prediction["hostname"] = hostname if hostname else f"unknown-{device_id}"
                predictions.append(prediction)
            except Exception as e:
                # For devices with no data or model, create a default prediction
                predictions.append({
                    "device_id": device_id,
                    "hostname": hostname if hostname else f"unknown-{device_id}",
                    "predicted_upload": 0,
                    "predicted_download": 0,
                    "confidence_score": 0
                })
                continue
        
        return {
            "predictions": predictions,
            "timestamp": datetime.now(),
            "days_ahead": days_ahead
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/device/{device_id}/history")
def get_device_history(device_id: int):
    """Get historical bandwidth data for a specific device"""
    try:
        # Get real data
        df = get_device_data(device_id)
        
        # If no real data, generate synthetic data
        if df.empty:
            df = generate_synthetic_data(device_id)
            df["is_synthetic"] = True
            
            # Get hostname
            engine = get_sqlalchemy_engine()
            hostname_query = f"SELECT hostname FROM networks WHERE id = {device_id}"
            hostname_df = pd.read_sql(hostname_query, engine)
            
            if not hostname_df.empty:
                df["hostname"] = hostname_df.iloc[0]["hostname"]
        
        # Convert to list of dictionaries for JSON response
        history = df.to_dict(orient="records")
        for record in history:
            record["created_at"] = record["created_at"].isoformat()
        
        # Indicate if data is synthetic
        is_synthetic = df.get("is_synthetic", [False])[0] if not df.empty else False
        
        return {
            "device_id": device_id, 
            "history": history, 
            "is_synthetic": is_synthetic
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Optional: Automatic training on startup
@app.on_event("startup")
def startup_event():
    try:
        train_models()
    except Exception as e:
        print(f"Warning: Could not train models on startup: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)