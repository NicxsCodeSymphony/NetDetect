"""
Utility script for testing database connection and seeding test data
"""
import mysql.connector
import pandas as pd
import sqlalchemy
from sqlalchemy import text
from datetime import datetime, timedelta
import random
import sys

# Database configuration
DB_CONFIG = {
    "host": "localhost",
    "user": "root",  # Change to your MySQL username
    "password": "goldfish123",  # Add your MySQL password
    "database": "netdetect"
}

def test_connection():
    """Test the MySQL connection"""
    try:
        # Try direct MySQL connection first
        conn = mysql.connector.connect(**DB_CONFIG)
        if conn.is_connected():
            print("MySQL Connection: SUCCESS")
            conn.close()
        
        # Then try SQLAlchemy connection
        engine = get_sqlalchemy_engine()
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            print("SQLAlchemy Connection: SUCCESS")
            
        return True
    except Exception as e:
        print(f"Connection Error: {str(e)}")
        return False

def get_sqlalchemy_engine():
    """Create a SQLAlchemy engine for pandas operations"""
    user = DB_CONFIG['user']
    password = DB_CONFIG['password']
    host = DB_CONFIG['host']
    database = DB_CONFIG['database']
    return sqlalchemy.create_engine(f"mysql+mysqlconnector://{user}:{password}@{host}/{database}")

def seed_test_data(num_devices=250, days_of_data=7):
    try:
        # Connect to the database
        engine = get_sqlalchemy_engine()
        
        # Generate data
        data = []
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_of_data)
        
        # Create timestamps at 6-hour intervals
        current_time = start_date
        timestamps = []
        while current_time <= end_date:
            timestamps.append(current_time)
            current_time += timedelta(hours=6)
        
        # Generate data for each device
        for device_id in range(1, num_devices + 1):
            # Decide if this is a high, medium or low usage device
            usage_pattern = random.choice(["high", "medium", "low", "zero"])
            
            for ts in timestamps:
                if usage_pattern == "high":
                    upload = random.randint(20, 100)
                    download = random.randint(1000, 5000)
                elif usage_pattern == "medium":
                    upload = random.randint(5, 30)
                    download = random.randint(100, 1500)
                elif usage_pattern == "low":
                    upload = random.randint(1, 10)
                    download = random.randint(1, 50)
                else:  # zero
                    upload = 0
                    download = 0
                
                # Add some variability based on time of day
                hour = ts.hour
                if 9 <= hour <= 17:  # Business hours
                    upload = int(upload * 1.5)
                    download = int(download * 1.5)
                
                data.append({
                    "device_id": device_id,
                    "upload": upload,
                    "download": download,
                    "created_at": ts
                })
        
        # Create DataFrame
        df = pd.DataFrame(data)
        
        # Write to database
        with engine.connect() as conn:
            # Check if table exists, create it if not
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bandwidth (
                bandwidth INT AUTO_INCREMENT PRIMARY KEY,
                device_id INT NOT NULL,
                upload INT NOT NULL,
                download INT NOT NULL,
                created_at DATETIME NOT NULL
            )
            """))
            
            # Clear existing data if requested
            conn.execute(text("DELETE FROM bandwidth"))
            conn.commit()
        
        # Insert new data
        df.to_sql('bandwidth', engine, if_exists='append', index=False)
        
        print(f"Successfully seeded {len(data)} records for {num_devices} devices")
        return True
    
    except Exception as e:
        print(f"Error seeding data: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "test":
            test_connection()
        
        elif command == "seed":
            # Get optional parameters
            num_devices = int(sys.argv[2]) if len(sys.argv) > 2 else 250  # Changed to 250
            days_of_data = int(sys.argv[3]) if len(sys.argv) > 3 else 7
            
            print(f"Seeding data for {num_devices} devices with {days_of_data} days of history...")
            seed_test_data(num_devices, days_of_data)
    
    else:
        print("Available commands:")
        print("  python utils.py test - Test database connection")
        print("  python utils.py seed [num_devices] [days_of_data] - Seed test data")