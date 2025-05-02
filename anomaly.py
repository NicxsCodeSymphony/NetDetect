from fastapi import FastAPI, HTTPException, Query, Depends, APIRouter
from typing import List, Dict, Optional, Union
from pydantic import BaseModel
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
import joblib
import os
from sqlalchemy import create_engine, text
import warnings
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

warnings.filterwarnings("ignore")



# Database configuration
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "goldfish123",
    "database": "netdetect"
}

# Create main FastAPI app
app = FastAPI(
    title="NetDetect Anomaly API",
    description="API for network traffic anomaly detection",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create router for anomaly detection endpoints
anomaly_router = APIRouter(
    prefix="/anomaly",
    tags=["anomaly detection"],
    responses={404: {"description": "Not found"}},
)

# Models
class DeviceInfo(BaseModel):
    device_id: int
    hostname: str
    ip_address: str
    mac_address: str
    device_type: str
    status: str
    whitelist: bool = False

class AnomalyResult(BaseModel):
    device_id: int
    hostname: str
    ip_address: str
    mac_address: str
    device_type: str
    status: str
    is_anomaly: bool
    anomaly_score: float
    recent_upload: float
    recent_download: float
    expected_upload: float
    expected_download: float
    upload_deviation_pct: float
    download_deviation_pct: float
    anomaly_reason: str
    timestamp: datetime

class AnomalyResponse(BaseModel):
    anomalies: List[AnomalyResult]
    total_devices: int
    anomalous_devices: int
    timestamp: datetime

# Database connection function
def get_sqlalchemy_engine():
    """Create and return a SQLAlchemy engine"""
    user = DB_CONFIG['user']
    password = DB_CONFIG['password']
    host = DB_CONFIG['host']
    database = DB_CONFIG['database']
    return create_engine(f"mysql+mysqlconnector://{user}:{password}@{host}/{database}")

def get_device_info(device_id: int = None):
    """Get device information from networks table"""
    query = """
    SELECT 
        id as device_id, 
        hostname, 
        ip_address, 
        mac_address, 
        device_type,
        whitelist,
        status
    FROM networks
    """
    
    # Fix: Use parameterized query instead of string interpolation
    params = {}
    if device_id:
        query += " WHERE id = :device_id"
        params['device_id'] = device_id
    
    query += " ORDER BY id"
    
    engine = get_sqlalchemy_engine()
    with engine.connect() as conn:
        # Use text() for SQL query with parameters
        result = conn.execute(text(query), params)
        # Convert to DataFrame
        df = pd.DataFrame(result.fetchall(), columns=result.keys())
    return df

def get_device_data(device_id: int = None, days_back: int = 30):
    """Get bandwidth data with hostname for the last days_back days"""
    query = """
    SELECT 
        bandwidth.device_id, 
        networks.hostname, 
        networks.ip_address,
        networks.mac_address,
        networks.device_type,
        networks.status,
        bandwidth.upload, 
        bandwidth.download, 
        bandwidth.created_at 
    FROM bandwidth
    JOIN networks ON bandwidth.device_id = networks.id
    WHERE bandwidth.created_at >= DATE_SUB(NOW(), INTERVAL :days_back DAY)
    """
    
    # Fix: Use parameterized query
    params = {'days_back': days_back}
    if device_id:
        query += " AND bandwidth.device_id = :device_id"
        params['device_id'] = device_id
    
    query += " ORDER BY bandwidth.device_id, bandwidth.created_at"
    
    engine = get_sqlalchemy_engine()
    with engine.connect() as conn:
        result = conn.execute(text(query), params)
        df = pd.DataFrame(result.fetchall(), columns=result.keys())
    return df

def get_recent_data(device_id: int = None, hours_back: int = 24):
    """Get most recent bandwidth data (last hours_back)"""
    query = """
    SELECT 
        bandwidth.device_id, 
        networks.hostname, 
        networks.ip_address,
        networks.mac_address,
        networks.device_type,
        networks.status,
        bandwidth.upload, 
        bandwidth.download, 
        bandwidth.created_at 
    FROM bandwidth
    JOIN networks ON bandwidth.device_id = networks.id
    WHERE bandwidth.created_at >= DATE_SUB(NOW(), INTERVAL :hours_back HOUR)
    """
    
    # Fix: Use parameterized query
    params = {'hours_back': hours_back}
    if device_id:
        query += " AND bandwidth.device_id = :device_id"
        params['device_id'] = device_id
    
    query += " ORDER BY bandwidth.device_id, bandwidth.created_at DESC"
    
    engine = get_sqlalchemy_engine()
    with engine.connect() as conn:
        result = conn.execute(text(query), params)
        df = pd.DataFrame(result.fetchall(), columns=result.keys())
    return df

def prepare_data_for_anomaly_detection(df, device_info_df=None):
    """Prepare data for anomaly detection by calculating statistical features and adding device context"""
    # Convert timestamp to datetime if it's not already
    if not pd.api.types.is_datetime64_any_dtype(df['created_at']):
        df['created_at'] = pd.to_datetime(df['created_at'])
    
    # If device_info_df not provided, get it
    if device_info_df is None:
        device_info_df = get_device_info()
        
    # Convert device_type to numerical
    device_type_map = {
        'Desktop PC': 1,
        'Laptop': 2,
        'Phone': 3
    }
    
    # Convert status to numerical
    status_map = {
        'online': 1,
        'offline': 0,
        'Inactive': -1
    }
    
    # Initialize an empty DataFrame to store the aggregated data
    device_stats = []
    
    # Group by device_id
    for device_id, group in df.groupby('device_id'):
        if len(group) < 2:  # Skip devices with insufficient data
            continue
            
        # Get device info
        device_info = device_info_df[device_info_df['device_id'] == device_id]
        if device_info.empty:
            # Skip if no device info found
            continue
        
        hostname = group['hostname'].iloc[0]
        ip_address = group['ip_address'].iloc[0]
        mac_address = group['mac_address'].iloc[0]
        device_type = group['device_type'].iloc[0]
        status = group['status'].iloc[0]
        
        # Numeric representations
        device_type_num = device_type_map.get(device_type, 0)
        status_num = status_map.get(status, -1)
        
        # Calculate statistical features
        upload_mean = group['upload'].mean()
        upload_std = group['upload'].std()
        upload_median = group['upload'].median()
        upload_max = group['upload'].max()
        upload_min = group['upload'].min()
        
        download_mean = group['download'].mean()
        download_std = group['download'].std()
        download_median = group['download'].median()
        download_max = group['download'].max()
        download_min = group['download'].min()
        
        # Calculate ratio and time-based features
        upload_download_ratio = upload_mean / download_mean if download_mean > 0 else 0
        
        # Add time features
        group['hour'] = group['created_at'].dt.hour
        group['day'] = group['created_at'].dt.day
        group['day_of_week'] = group['created_at'].dt.dayofweek
        
        # Calculate hourly patterns
        hourly_upload = group.groupby('hour')['upload'].mean().mean()
        hourly_download = group.groupby('hour')['download'].mean().mean()
        
        # Calculate weekday patterns
        weekday_upload = group.groupby('day_of_week')['upload'].mean().mean()
        weekday_download = group.groupby('day_of_week')['download'].mean().mean()
        
        # Business hours patterns (9 AM to 5 PM)
        business_hours = (group['hour'] >= 9) & (group['hour'] <= 17)
        business_upload = group[business_hours]['upload'].mean() if any(business_hours) else 0
        business_download = group[business_hours]['download'].mean() if any(business_hours) else 0
        
        non_business_upload = group[~business_hours]['upload'].mean() if any(~business_hours) else 0
        non_business_download = group[~business_hours]['download'].mean() if any(~business_hours) else 0
        
        # Business/non-business ratio
        business_ratio_upload = business_upload / non_business_upload if non_business_upload > 0 else 0
        business_ratio_download = business_download / non_business_download if non_business_download > 0 else 0
        
        # Assemble the statistics for this device
        device_stats.append({
            'device_id': device_id,
            'hostname': hostname,
            'ip_address': ip_address,
            'mac_address': mac_address,
            'device_type': device_type,
            'device_type_num': device_type_num,
            'status': status,
            'status_num': status_num,
            'upload_mean': upload_mean,
            'upload_std': upload_std,
            'upload_median': upload_median,
            'upload_max': upload_max,
            'upload_min': upload_min,
            'download_mean': download_mean,
            'download_std': download_std,
            'download_median': download_median,
            'download_max': download_max,
            'download_min': download_min,
            'upload_download_ratio': upload_download_ratio,
            'hourly_upload': hourly_upload,
            'hourly_download': hourly_download,
            'weekday_upload': weekday_upload,
            'weekday_download': weekday_download,
            'business_upload': business_upload,
            'business_download': business_download,
            'non_business_upload': non_business_upload,
            'non_business_download': non_business_download,
            'business_ratio_upload': business_ratio_upload,
            'business_ratio_download': business_ratio_download
        })
    
    if not device_stats:
        return pd.DataFrame()
        
    return pd.DataFrame(device_stats)

def determine_anomaly_reason(row, baseline):
    """Determine the reason for the anomaly"""
    reasons = []
    
    # Upload deviation
    if row['upload_deviation_pct'] > 200:  # More than 3x expected
        reasons.append("Excessive upload traffic")
    elif row['upload_deviation_pct'] < -80:  # Less than 20% of expected
        reasons.append("Unusually low upload traffic")
        
    # Download deviation
    if row['download_deviation_pct'] > 200:  # More than 3x expected
        reasons.append("Excessive download traffic")
    elif row['download_deviation_pct'] < -80:  # Less than 20% of expected
        reasons.append("Unusually low download traffic")
    
    # Odd hours (if baseline shows mostly business hours activity)
    if baseline['business_ratio_download'] > 5 and row['hour'] not in range(8, 18):
        reasons.append("Activity outside normal business hours")
    
    # Unusual upload/download ratio
    baseline_ratio = baseline['upload_download_ratio']
    current_ratio = row['recent_upload'] / max(row['recent_download'], 1)
    
    if baseline_ratio > 0.1:  # Only check if baseline has a meaningful ratio
        if current_ratio > baseline_ratio * 5:
            reasons.append("Unusual upload/download ratio (high uploads)")
        elif current_ratio * 5 < baseline_ratio:
            reasons.append("Unusual upload/download ratio (high downloads)")
    
    # Device type specific
    if row['device_type'] == 'Desktop PC' and row['recent_upload'] > 100:
        reasons.append("High upload for desktop computer")
        
    if row['device_type'] == 'Phone' and row['recent_download'] > 1000:
        reasons.append("Excessive download for mobile device")
    
    # Status anomalies
    if row['status'] == 'offline' and (row['recent_upload'] > 0 or row['recent_download'] > 0):
        reasons.append("Traffic detected from offline device")
    
    # IP address change (would need to compare to historical records)
    
    if not reasons:
        return "Unknown anomaly pattern"
    
    return "; ".join(reasons)

def train_anomaly_detection_model():
    """Train an anomaly detection model using Isolation Forest with device context"""
    # Create models directory if it doesn't exist
    if not os.path.exists('models'):
        os.makedirs('models')
    
    # Get device info first
    device_info_df = get_device_info()
    
    # Get historical data for the last 30 days
    df = get_device_data(days_back=30)
    
    if df.empty:
        raise ValueError("No bandwidth data available for training anomaly detection model")
    
    # Prepare data with device context
    device_stats = prepare_data_for_anomaly_detection(df, device_info_df)
    
    if device_stats.empty:
        raise ValueError("Insufficient data for anomaly detection model training")
    
    # Features to use for anomaly detection
    features = [
        'device_type_num', 'status_num',
        'upload_mean', 'upload_std', 'upload_median', 'upload_max', 'upload_min',
        'download_mean', 'download_std', 'download_median', 'download_max', 'download_min',
        'upload_download_ratio', 'hourly_upload', 'hourly_download', 
        'weekday_upload', 'weekday_download',
        'business_upload', 'business_download', 
        'non_business_upload', 'non_business_download',
        'business_ratio_upload', 'business_ratio_download'
    ]
    
    # Extract features for training
    X = device_stats[features].fillna(0)
    
    # Standardize the data
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Train an Isolation Forest model
    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,  # Expected proportion of anomalies (5%)
        random_state=42
    )
    
    model.fit(X_scaled)
    
    # Save model and scaler
    joblib.dump(model, 'models/anomaly_detection_model.pkl')
    joblib.dump(scaler, 'models/anomaly_detection_scaler.pkl')
    joblib.dump(features, 'models/anomaly_detection_features.pkl')
    
    # Also save baseline stats for each device
    device_stats.to_csv('models/device_baselines.csv', index=False)
    
    return {
        'model': model,
        'scaler': scaler,
        'features': features,
        'device_stats': device_stats
    }

def detect_anomalies(hours_back: int = 24, anomaly_threshold: float = -0.5):
    """Detect anomalies in recent bandwidth usage"""
    # Check if model exists, if not, train it
    model_path = 'models/anomaly_detection_model.pkl'
    scaler_path = 'models/anomaly_detection_scaler.pkl'
    features_path = 'models/anomaly_detection_features.pkl'
    baseline_path = 'models/device_baselines.csv'
    
    try:
        if not (os.path.exists(model_path) and os.path.exists(scaler_path) 
                and os.path.exists(features_path) and os.path.exists(baseline_path)):
            print("Training new anomaly detection model...")
            train_result = train_anomaly_detection_model()
            model = train_result['model']
            scaler = train_result['scaler']
            features = train_result['features']
            baseline_stats = train_result['device_stats']
        else:
            model = joblib.load(model_path)
            scaler = joblib.load(scaler_path)
            features = joblib.load(features_path)
            baseline_stats = pd.read_csv(baseline_path)
    except Exception as e:
        print(f"Error loading or training anomaly model: {str(e)}")
        raise
    
    # Get device info
    device_info_df = get_device_info()
    
    # Get recent data
    recent_data = get_recent_data(hours_back=hours_back)
    
    if recent_data.empty:
        return {
            'anomalies': [],
            'total_devices': len(device_info_df),
            'anomalous_devices': 0,
            'timestamp': datetime.now()
        }
    
    # Prepare recent data with device context
    recent_stats = prepare_data_for_anomaly_detection(recent_data, device_info_df)
    
    if recent_stats.empty:
        return {
            'anomalies': [],
            'total_devices': len(device_info_df),
            'anomalous_devices': 0,
            'timestamp': datetime.now()
        }
    
    # Apply the model to detect anomalies
    X_recent = recent_stats[features].fillna(0)
    X_scaled = scaler.transform(X_recent)
    
    # Get anomaly scores (-1 for anomaly, 1 for normal)
    anomaly_predictions = model.predict(X_scaled)
    anomaly_scores = model.decision_function(X_scaled)
    
    # Add predictions and scores to the data
    recent_stats['is_anomaly'] = anomaly_predictions == -1
    recent_stats['anomaly_score'] = anomaly_scores
    
    # Mark as anomaly if score is below threshold
    recent_stats['is_anomaly'] = recent_stats['anomaly_score'] < anomaly_threshold
    
    # Calculate the most recent values
    most_recent_values = recent_data.sort_values('created_at', ascending=False).groupby('device_id').first()
    
    # Prepare the result
    anomalies = []
    
    for _, row in recent_stats.iterrows():
        device_id = row['device_id']
        
        # Get baseline stats from historical data
        baseline = baseline_stats[baseline_stats['device_id'] == device_id]
        if baseline.empty:
            baseline = row  # Use current stats if no historical data
        else:
            baseline = baseline.iloc[0]
        
        # Get most recent values
        if device_id in most_recent_values.index:
            recent_upload = most_recent_values.loc[device_id, 'upload']
            recent_download = most_recent_values.loc[device_id, 'download']
            recent_hour = most_recent_values.loc[device_id, 'created_at'].hour
        else:
            recent_upload = row['upload_mean'] if 'upload_mean' in row else 0
            recent_download = row['download_mean'] if 'download_mean' in row else 0
            recent_hour = datetime.now().hour
        
        # Calculate deviation
        expected_upload = baseline['upload_mean'] if 'upload_mean' in baseline else 0
        expected_download = baseline['download_mean'] if 'download_mean' in baseline else 0
        
        # Avoid division by zero
        upload_deviation_pct = ((recent_upload - expected_upload) / max(expected_upload, 1)) * 100 if expected_upload > 0 else 0
        download_deviation_pct = ((recent_download - expected_download) / max(expected_download, 1)) * 100 if expected_download > 0 else 0
        
        # Add hour to help determine reason
        row['hour'] = recent_hour
        row['recent_upload'] = recent_upload
        row['recent_download'] = recent_download
        row['upload_deviation_pct'] = upload_deviation_pct
        row['download_deviation_pct'] = download_deviation_pct
        
        # Determine reason for anomaly
        anomaly_reason = determine_anomaly_reason(row, baseline) if row['is_anomaly'] else "Normal traffic pattern"
        
        # Add this device to the result if it's an anomaly
        if row['is_anomaly']:
            anomalies.append({
                'device_id': int(device_id),
                'hostname': row['hostname'],
                'ip_address': row['ip_address'],
                'mac_address': row['mac_address'],
                'device_type': row['device_type'],
                'status': row['status'],
                'is_anomaly': bool(row['is_anomaly']),
                'anomaly_score': float(row['anomaly_score']),
                'recent_upload': float(recent_upload),
                'recent_download': float(recent_download),
                'expected_upload': float(expected_upload),
                'expected_download': float(expected_download),
                'upload_deviation_pct': float(upload_deviation_pct),
                'download_deviation_pct': float(download_deviation_pct),
                'anomaly_reason': anomaly_reason,
                'timestamp': datetime.now()
            })
    
    return {
        'anomalies': anomalies,
        'total_devices': len(device_info_df),
        'anomalous_devices': len(anomalies),
        'timestamp': datetime.now()
    }

def detect_offline_devices_with_traffic():
    """Detect offline devices that still have traffic"""
    # Get device info
    device_info_df = get_device_info()
    
    # Get recent data (last hour)
    recent_data = get_recent_data(hours_back=1)
    
    if recent_data.empty:
        return {
            'anomalies': [],
            'total_devices': len(device_info_df),
            'anomalous_devices': 0,
            'timestamp': datetime.now()
        }
    
    # Find offline devices with traffic
    offline_with_traffic = []
    
    for _, device in device_info_df.iterrows():
        if device['status'].lower() == 'offline':
            device_id = device['device_id']
            # Check if this device has recent traffic
            device_traffic = recent_data[recent_data['device_id'] == device_id]
            
            if not device_traffic.empty:
                # Check if there's actual traffic
                has_traffic = any(device_traffic['upload'] > 0) or any(device_traffic['download'] > 0)
                
                if has_traffic:
                    # Get most recent traffic values
                    recent = device_traffic.sort_values('created_at', ascending=False).iloc[0]
                    
                    offline_with_traffic.append({
                        'device_id': int(device_id),
                        'hostname': device['hostname'],
                        'ip_address': device['ip_address'],
                        'mac_address': device['mac_address'],
                        'device_type': device['device_type'],
                        'status': 'offline',
                        'is_anomaly': True,
                        'anomaly_score': -1.0,  # Maximum anomaly score
                        'recent_upload': float(recent['upload']),
                        'recent_download': float(recent['download']),
                        'expected_upload': 0.0,
                        'expected_download': 0.0,
                        'upload_deviation_pct': 100.0,
                        'download_deviation_pct': 100.0,
                        'anomaly_reason': "Traffic detected from offline device",
                        'timestamp': datetime.now()
                    })
    
    return {
        'anomalies': offline_with_traffic,
        'total_devices': len(device_info_df),
        'anomalous_devices': len(offline_with_traffic),
        'timestamp': datetime.now()
    }

def detect_unusual_device_behavior():
    """Detect unusual device behavior based on historical patterns"""
    # Get device info
    device_info_df = get_device_info()
    
    # Get recent data (last 24 hours)
    recent_data = get_recent_data(hours_back=24)
    
    if recent_data.empty:
        return {
            'anomalies': [],
            'total_devices': len(device_info_df),
            'anomalous_devices': 0,
            'timestamp': datetime.now()
        }
    
    # Get historical data (last 30 days)
    historical_data = get_device_data(days_back=30)
    
    # For each device, check patterns
    unusual_behaviors = []
    
    for _, device in device_info_df.iterrows():
        device_id = device['device_id']
        
        # Get recent and historical data for this device
        recent_device_data = recent_data[recent_data['device_id'] == device_id]
        historical_device_data = historical_data[historical_data['device_id'] == device_id]
        
        if recent_device_data.empty or historical_device_data.empty:
            continue
        
        # Calculate baseline statistics
        baseline_upload = historical_device_data['upload'].mean()
        baseline_download = historical_device_data['download'].mean()
        baseline_ratio = baseline_upload / baseline_download if baseline_download > 0 else 0
        
        # Calculate recent statistics
        recent_upload = recent_device_data['upload'].mean()
        recent_download = recent_device_data['download'].mean()
        recent_ratio = recent_upload / recent_download if recent_download > 0 else 0
        
        # Flag for unusual behavior
        is_unusual = False
        reason = ""
        
        # Check for significant deviations
        upload_deviation = (recent_upload - baseline_upload) / max(baseline_upload, 1)
        download_deviation = (recent_download - baseline_download) / max(baseline_download, 1)
        
        # Check if there are enough historical data points
        if len(historical_device_data) >= 5:
            # Check deviations
            if upload_deviation > 5:  # More than 5x baseline
                is_unusual = True
                reason = f"Upload traffic {upload_deviation:.1f}x higher than normal"
            elif download_deviation > 5:  # More than 5x baseline
                is_unusual = True
                reason = f"Download traffic {download_deviation:.1f}x higher than normal"
            
            # Check ratio change
            if baseline_ratio > 0.1 and recent_ratio > 0:  # Only check if ratios are meaningful
                ratio_change = abs(recent_ratio - baseline_ratio) / max(baseline_ratio, 0.1)
                if ratio_change > 5:
                    is_unusual = True
                    if recent_ratio > baseline_ratio:
                        reason += "; Unusual increase in upload/download ratio"
                    else:
                        reason += "; Unusual decrease in upload/download ratio"
        
        # Add device specific checks
        if device['device_type'] == 'Desktop PC' and recent_upload > 500:
            is_unusual = True
            reason += "; Excessive upload for desktop PC"
        
        if device['device_type'] == 'Phone' and recent_download > 2000:
            is_unusual = True
            reason += "; Excessive download for phone"
        
        # If unusual, add to results
        if is_unusual:
            if reason.startswith("; "):
                reason = reason[2:]
                
            unusual_behaviors.append({
                'device_id': int(device_id),
                'hostname': device['hostname'],
                'ip_address': device['ip_address'],
                'mac_address': device['mac_address'],
                'device_type': device['device_type'],
                'status': device['status'],
                'is_anomaly': True,
                'anomaly_score': -0.8,  # High anomaly score
                'recent_upload': float(recent_upload),
                'recent_download': float(recent_download),
                'expected_upload': float(baseline_upload),
                'expected_download': float(baseline_download),
                'upload_deviation_pct': float(upload_deviation * 100),
                'download_deviation_pct': float(download_deviation * 100),
                'anomaly_reason': reason,
                'timestamp': datetime.now()
            })
    
    return {
        'anomalies': unusual_behaviors,
        'total_devices': len(device_info_df),
        'anomalous_devices': len(unusual_behaviors),
        'timestamp': datetime.now()
    }

# API Endpoints
@anomaly_router.post("/train")
def train_model_endpoint():
    """Train the anomaly detection model"""
    try:
        result = train_anomaly_detection_model()
        return {
            "status": "success",
            "message": f"Anomaly detection model trained successfully with {len(result['device_stats'])} devices"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error training model: {str(e)}")

@anomaly_router.get("/detect")
def detect_anomalies_endpoint(
    hours_back: int = Query(24, description="Hours of data to check for anomalies", ge=1, le=168),
    threshold: float = Query(-0.5, description="Anomaly detection threshold (lower is more sensitive)", ge=-1, le=0)
):
    """Detect anomalies in recent network traffic"""
    try:
        result = detect_anomalies(hours_back=hours_back, anomaly_threshold=threshold)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting anomalies: {str(e)}")

@anomaly_router.get("/detect-offline-traffic")
def detect_offline_traffic_endpoint():
    """Detect traffic from devices marked as offline"""
    try:
        result = detect_offline_devices_with_traffic()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting offline traffic: {str(e)}")

@anomaly_router.get("/detect-unusual-behavior")
def detect_unusual_behavior_endpoint():
    """Detect unusual device behavior based on historical patterns"""
    try:
        result = detect_unusual_device_behavior()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting unusual behavior: {str(e)}")

@anomaly_router.get("/device/{device_id}")
def get_device_anomaly_status(
    device_id: int,
    hours_back: int = Query(24, description="Hours of data to check", ge=1, le=168)
):
    """Get anomaly status for a specific device"""
    try:
        # Get device info
        device_info = get_device_info(device_id=device_id)
        
        if device_info.empty:
            raise HTTPException(status_code=404, detail=f"No device found with ID {device_id}")
        
        # Get recent data for this device
        recent_data = get_recent_data(device_id=device_id, hours_back=hours_back)
        
        if recent_data.empty:
            raise HTTPException(status_code=404, detail=f"No recent data found for device {device_id}")
        
        # Run anomaly detection
        all_anomalies = detect_anomalies(hours_back=hours_back)
        
        # Filter anomalies for this device
        device_anomalies = [a for a in all_anomalies['anomalies'] if a['device_id'] == device_id]
        
        if device_anomalies:
            return device_anomalies[0]
        
        # If not an anomaly, return normal status
        device_info_row = device_info.iloc[0]
        hostname = device_info_row['hostname']
        ip_address = device_info_row['ip_address']
        mac_address = device_info_row['mac_address']
        device_type = device_info_row['device_type']
        status = device_info_row['status']
        
        # Get historical data for baseline
        historical_data = get_device_data(device_id=device_id, days_back=30)
        
        # Calculate baseline statistics
        expected_upload = historical_data['upload'].mean() if not historical_data.empty else 0
        expected_download = historical_data['download'].mean() if not historical_data.empty else 0
        
        # Get most recent values
        recent_device_data = recent_data.sort_values('created_at', ascending=False)
        recent_upload = recent_device_data['upload'].iloc[0]
        recent_download = recent_device_data['download'].iloc[0]
        
        # Calculate deviation
        upload_deviation_pct = ((recent_upload - expected_upload) / max(expected_upload, 1)) * 100 if expected_upload > 0 else 0
        download_deviation_pct = ((recent_download - expected_download) / max(expected_download, 1)) * 100 if expected_download > 0 else 0
        
        return {
            'device_id': device_id,
            'hostname': hostname,
            'ip_address': ip_address,
            'mac_address': mac_address,
            'device_type': device_type,
            'status': status,
            'is_anomaly': False,
            'anomaly_score': 0,  # Normal score
            'recent_upload': float(recent_upload),
            'recent_download': float(recent_download),
            'expected_upload': float(expected_upload),
            'expected_download': float(expected_download),
            'upload_deviation_pct': float(upload_deviation_pct),
            'download_deviation_pct': float(download_deviation_pct),
            'anomaly_reason': "Normal traffic pattern",
            'timestamp': datetime.now()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking device anomaly status: {str(e)}")

@anomaly_router.get("/device-type/{device_type}")
def get_anomalies_by_device_type(
    device_type: str,
    hours_back: int = Query(24, description="Hours of data to check", ge=1, le=168)
):
    """Get anomalies for a specific device type (Desktop PC, Laptop, Phone)"""
    try:
        # Validate device type
        valid_types = ["Desktop PC", "Laptop", "Phone"]
        if device_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid device type. Must be one of: {', '.join(valid_types)}")
        
        # Run anomaly detection
        all_anomalies = detect_anomalies(hours_back=hours_back)
        
        # Filter anomalies for this device type
        type_anomalies = [a for a in all_anomalies['anomalies'] if a['device_type'] == device_type]
        
        # Get device info for device count
        device_info_df = get_device_info()
        type_devices = device_info_df[device_info_df['device_type'] == device_type]
        
        return {
            'anomalies': type_anomalies,
            'total_devices': len(type_devices),
            'anomalous_devices': len(type_anomalies),
            'device_type': device_type,
            'timestamp': datetime.now()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting anomalies by device type: {str(e)}")

@anomaly_router.get("/status/{status}")
def get_anomalies_by_status(
    status: str,
    hours_back: int = Query(24, description="Hours of data to check", ge=1, le=168)
):
    """Get anomalies for a specific device status (online, offline, inactive)"""
    try:
        # Validate status
        valid_statuses = ["online", "offline", "inactive"]
        if status.lower() not in [s.lower() for s in valid_statuses]:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        
        # Run anomaly detection
        all_anomalies = detect_anomalies(hours_back=hours_back)
        
        # Filter anomalies for this status
        status_anomalies = [a for a in all_anomalies['anomalies'] if a['status'].lower() == status.lower()]
        
        # Get device info for device count
        device_info_df = get_device_info()
        status_devices = device_info_df[device_info_df['status'].str.lower() == status.lower()]
        
        return {
            'anomalies': status_anomalies,
            'total_devices': len(status_devices),
            'anomalous_devices': len(status_anomalies),
            'status': status,
            'timestamp': datetime.now()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting anomalies by status: {str(e)}")

@anomaly_router.post("/whitelist/{device_id}")
def whitelist_device(device_id: int):
    """Add a device to the whitelist (ignore in anomaly detection)"""
    try:
        # Get device info
        device_info = get_device_info(device_id=device_id)
        
        if device_info.empty:
            raise HTTPException(status_code=404, detail=f"No device found with ID {device_id}")
        
        # Update whitelist status in database
        engine = get_sqlalchemy_engine()
        with engine.connect() as conn:
            # Fix: Use parameterized query
            query = text("UPDATE networks SET whitelist = 1 WHERE id = :device_id")
            conn.execute(query, {"device_id": device_id})
            conn.commit()
        
        return {
            "status": "success",
            "message": f"Device {device_id} ({device_info.iloc[0]['hostname']}) added to whitelist"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error whitelisting device: {str(e)}")

@anomaly_router.post("/unwhitelist/{device_id}")
def unwhitelist_device(device_id: int):
    """Remove a device from the whitelist"""
    try:
        # Get device info
        device_info = get_device_info(device_id=device_id)
        
        if device_info.empty:
            raise HTTPException(status_code=404, detail=f"No device found with ID {device_id}")
        
        # Update whitelist status in database
        engine = get_sqlalchemy_engine()
        with engine.connect() as conn:
            # Fix: Use parameterized query
            query = text("UPDATE networks SET whitelist = 0 WHERE id = :device_id")
            conn.execute(query, {"device_id": device_id})
            conn.commit()
        
        return {
            "status": "success",
            "message": f"Device {device_id} ({device_info.iloc[0]['hostname']}) removed from whitelist"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing device from whitelist: {str(e)}")

@anomaly_router.get("/devices-by-network/{subnet}")
def get_anomalies_by_subnet(
    subnet: str,
    hours_back: int = Query(24, description="Hours of data to check", ge=1, le=168)
):
    """Get anomalies for devices in a specific subnet (e.g., '192.168.3' or '192.168.155')"""
    try:
        # Run anomaly detection
        all_anomalies = detect_anomalies(hours_back=hours_back)
        
        # Filter anomalies for this subnet
        subnet_anomalies = [a for a in all_anomalies['anomalies'] if a['ip_address'].startswith(subnet)]
        
        # Get device info for device count
        device_info_df = get_device_info()
        subnet_devices = device_info_df[device_info_df['ip_address'].str.startswith(subnet)]
        
        return {
            'anomalies': subnet_anomalies,
            'total_devices': len(subnet_devices),
            'anomalous_devices': len(subnet_anomalies),
            'subnet': subnet,
            'timestamp': datetime.now()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting anomalies by subnet: {str(e)}")

@anomaly_router.get("/top-anomalies")
def get_top_anomalies(
    limit: int = Query(10, description="Number of top anomalies to return", ge=1, le=100),
    hours_back: int = Query(24, description="Hours of data to check", ge=1, le=168)
):
    """Get the top N devices with the highest anomaly scores"""
    try:
        # Run anomaly detection
        all_anomalies = detect_anomalies(hours_back=hours_back)
        
        # Sort anomalies by score (lowest score = highest anomaly)
        sorted_anomalies = sorted(all_anomalies['anomalies'], key=lambda x: x['anomaly_score'])
        
        # Get top N
        top_anomalies = sorted_anomalies[:limit]
        
        return {
            'anomalies': top_anomalies,
            'total_anomalies': len(all_anomalies['anomalies']),
            'limit': limit,
            'timestamp': datetime.now()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting top anomalies: {str(e)}")

@anomaly_router.get("/stats")
def get_anomaly_stats():
    """Get statistics about anomaly detection"""
    try:
        # Get all device info
        device_info_df = get_device_info()
        
        # Get stats by device type
        device_type_counts = device_info_df['device_type'].value_counts().to_dict()
        
        # Get stats by status
        status_counts = device_info_df['status'].value_counts().to_dict()
        
        # Count whitelisted devices
        whitelist_count = int(device_info_df['whitelist'].sum())
        
        # Get subnet counts
        subnets = []
        for ip in device_info_df['ip_address']:
            parts = ip.split('.')
            if len(parts) >= 3:
                subnet = f"{parts[0]}.{parts[1]}.{parts[2]}"
                subnets.append(subnet)
        
        subnet_counts = {}
        for subnet in set(subnets):
            subnet_counts[subnet] = subnets.count(subnet)
        
        # Run 24-hour anomaly detection
        try:
            anomalies_24h = detect_anomalies(hours_back=24)
            anomaly_count_24h = len(anomalies_24h['anomalies'])
            
            # Get anomalies by device type
            anomalies_by_type = {}
            for device_type in device_type_counts.keys():
                anomalies_by_type[device_type] = len([a for a in anomalies_24h['anomalies'] if a['device_type'] == device_type])
            
            # Get anomalies by status
            anomalies_by_status = {}
            for status in status_counts.keys():
                anomalies_by_status[status] = len([a for a in anomalies_24h['anomalies'] if a['status'].lower() == status.lower()])
            
            # Get anomalies by subnet
            anomalies_by_subnet = {}
            for subnet in subnet_counts.keys():
                anomalies_by_subnet[subnet] = len([a for a in anomalies_24h['anomalies'] if a['ip_address'].startswith(subnet)])
        except:
            # If anomaly detection fails, use empty values
            anomaly_count_24h = 0
            anomalies_by_type = {dt: 0 for dt in device_type_counts.keys()}
            anomalies_by_status = {s: 0 for s in status_counts.keys()}
            anomalies_by_subnet = {sn: 0 for sn in subnet_counts.keys()}
        
        return {
            'total_devices': len(device_info_df),
            'device_type_counts': device_type_counts,
            'status_counts': status_counts,
            'subnet_counts': subnet_counts,
            'whitelist_count': whitelist_count,
            'anomaly_count_24h': anomaly_count_24h,
            'anomalies_by_type': anomalies_by_type,
            'anomalies_by_status': anomalies_by_status,
            'anomalies_by_subnet': anomalies_by_subnet,
            'timestamp': datetime.now()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting anomaly stats: {str(e)}")

# Include the router in the main app
app.include_router(anomaly_router)

# Startup event to train the model at startup
@app.on_event("startup")
async def startup_train_anomaly_model():
    try:
        if not os.path.exists('models/anomaly_detection_model.pkl'):
            print("Training anomaly detection model on startup...")
            train_anomaly_detection_model()
    except Exception as e:
        print(f"Warning: Could not train anomaly detection model on startup: {str(e)}")

# Add a root endpoint for API info
@app.get("/", tags=["root"])
def read_root():
    return {
        "name": "NetDetect Anomaly API",
        "version": "1.0.0",
        "description": "API for network traffic anomaly detection",
        "endpoints": {
            "anomaly detection": "/anomaly/",
            "documentation": "/docs",
            "openapi": "/openapi.json"
        }
    }

# Add a health check endpoint
@app.get("/health", tags=["health"])
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now()
    }

# Main function to run the app
if __name__ == "__main__":
    uvicorn.run("anomaly:app", host="0.0.0.0", port=8006, reload=True)