from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy import create_engine, Column, Integer, Float, DateTime, func, desc
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import uvicorn
from datetime import datetime, timedelta
import numpy as np
from statistics import mean, stdev

# Database connection
DATABASE_URL = "mysql+pymysql://root:goldfish123@localhost/netdetect"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database model
class Bandwidth(Base):
    __tablename__ = "bandwidth"
    
    bandwidth = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(Integer, nullable=False)
    upload = Column(Float, nullable=False)
    download = Column(Float, nullable=False)
    created_at = Column(DateTime, default=func.now())

# Pydantic models for request/response
class BandwidthBase(BaseModel):
    device_id: int
    upload: float
    download: float

class BandwidthCreate(BandwidthBase):
    pass

class BandwidthResponse(BandwidthBase):
    bandwidth: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class TrafficClassification(BaseModel):
    device_id: int
    classification: str
    upload: float
    download: float
    total_usage: float
    timestamp: datetime

class SpikeAnalysisResult(BaseModel):
    device_id: int
    has_spike: bool
    spike_timestamp: Optional[datetime] = None
    spike_value: Optional[float] = None
    baseline_average: float
    percentage_increase: Optional[float] = None
    probable_cause: Optional[str] = None
    confidence: Optional[float] = None
    details: Dict[str, Any]

app = FastAPI(title="Traffic Classification API", description="API for network traffic classification and bandwidth monitoring")

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper function to classify traffic based on bandwidth usage
def classify_traffic(upload: float, download: float) -> str:
    total = upload + download
    
    if total < 1:  # Less than 1 MB/s
        return "LOW"
    elif total < 10:  # Between 1-10 MB/s
        return "MEDIUM"
    else:  # More than 10 MB/s
        return "HIGH"

# Helper function to detect and analyze traffic spikes
def analyze_traffic_spike(device_id: int, records: List[Bandwidth], timeframe_hours: int = 24) -> SpikeAnalysisResult:
    # Ensure we have enough data
    if len(records) < 3:
        return SpikeAnalysisResult(
            device_id=device_id,
            has_spike=False,
            baseline_average=0,
            details={"error": "Insufficient data for spike analysis"}
        )
    
    # Extract total bandwidth values (upload + download)
    timestamps = [record.created_at for record in records]
    totals = [record.upload + record.download for record in records]
    
    # Basic statistics
    avg_traffic = mean(totals)
    if len(totals) > 1:
        try:
            traffic_stdev = stdev(totals)
        except:
            traffic_stdev = 0.1 * avg_traffic  # Fallback if stdev calculation fails
    else:
        traffic_stdev = 0.1 * avg_traffic  # Approximation for single point
    
    # Define spike threshold (3 standard deviations above mean or at least double the average)
    spike_threshold = max(avg_traffic + (3 * traffic_stdev), avg_traffic * 2)
    
    # Find the spike (if any)
    spike_index = None
    for i, total in enumerate(totals):
        if total > spike_threshold:
            if spike_index is None or total > totals[spike_index]:
                spike_index = i
    
    if spike_index is None:
        # No spike detected
        return SpikeAnalysisResult(
            device_id=device_id,
            has_spike=False,
            baseline_average=avg_traffic,
            details={
                "timeframe_hours": timeframe_hours,
                "data_points": len(records),
                "threshold": spike_threshold,
                "max_value": max(totals) if totals else 0,
                "standard_deviation": traffic_stdev
            }
        )
    
    # Analyze spike characteristics
    spike_value = totals[spike_index]
    spike_timestamp = timestamps[spike_index]
    percentage_increase = ((spike_value - avg_traffic) / avg_traffic) * 100 if avg_traffic > 0 else 100
    
    # Determine the probable cause based on characteristics
    cause, confidence = determine_spike_cause(records[spike_index], records, percentage_increase)
    
    # Enhanced data for analysis
    upload_ratio = records[spike_index].upload / spike_value if spike_value > 0 else 0
    download_ratio = records[spike_index].download / spike_value if spike_value > 0 else 0
    spike_details = {
        "upload_mb": records[spike_index].upload,
        "download_mb": records[spike_index].download,
        "upload_ratio": upload_ratio,
        "download_ratio": download_ratio,
        "timeframe_hours": timeframe_hours,
        "data_points": len(records),
        "threshold": spike_threshold,
        "standard_deviation": traffic_stdev,
        "sudden_increase": percentage_increase > 200,  # Boolean flag for very sudden increases
        "sustained_spike": is_sustained_spike(spike_index, totals)
    }
    
    return SpikeAnalysisResult(
        device_id=device_id,
        has_spike=True,
        spike_timestamp=spike_timestamp,
        spike_value=spike_value,
        baseline_average=avg_traffic,
        percentage_increase=percentage_increase,
        probable_cause=cause,
        confidence=confidence,
        details=spike_details
    )

def determine_spike_cause(spike_record: Bandwidth, all_records: List[Bandwidth], percentage_increase: float) -> tuple:
    """Determine the most likely cause of a traffic spike based on patterns"""
    # Extract the spike data
    upload = spike_record.upload
    download = spike_record.download
    total = upload + download
    
    # Calculate ratios that help identify types of activity
    upload_ratio = upload / total if total > 0 else 0
    download_ratio = download / total if total > 0 else 0
    
    # Define cause determination rules
    causes = []
    confidences = []
    
    # Rule 1: Very high download ratio suggests file download or streaming
    if download_ratio > 0.85 and download > 20:
        causes.append("Large file download or video streaming")
        confidences.append(0.85)
    
    # Rule 2: Very high upload ratio suggests file upload or backup
    if upload_ratio > 0.85 and upload > 20:
        causes.append("File upload or backup activity")
        confidences.append(0.85)
    
    # Rule 3: Balanced ratio with high total suggests peer-to-peer activity
    if 0.4 < upload_ratio < 0.6 and total > 15:
        causes.append("Peer-to-peer file sharing")
        confidences.append(0.75)
    
    # Rule 4: Extremely sudden and high spike might be malicious
    if percentage_increase > 500 and total > 50:
        causes.append("Possible DDoS attack or network scan")
        confidences.append(0.6)
    
    # Rule 5: Moderate download with moderate increase suggests software update
    if 0.7 < download_ratio < 0.95 and 5 < download < 20 and 100 < percentage_increase < 400:
        causes.append("Software update or application download")
        confidences.append(0.7)
    
    # Rule 6: Pattern analysis for repeated moderate spikes (system backups)
    if is_recurring_pattern(all_records):
        causes.append("Scheduled backup or automated task")
        confidences.append(0.8)
    
    # Rule 7: Default fallback for unclassified spikes
    if not causes:
        if download_ratio > 0.5:
            causes.append("Increased download activity")
            confidences.append(0.5)
        else:
            causes.append("Increased upload activity")
            confidences.append(0.5)
    
    # Return the most confident cause
    max_index = confidences.index(max(confidences)) if confidences else 0
    return causes[max_index] if causes else "Unknown cause", confidences[max_index] if confidences else 0.0

def is_recurring_pattern(records: List[Bandwidth]) -> bool:
    """Check if there's a recurring pattern in the traffic data suggesting scheduled activities"""
    if len(records) < 6:  # Need sufficient data to detect patterns
        return False
    
    # Sort records by timestamp to ensure proper sequence
    sorted_records = sorted(records, key=lambda x: x.created_at)
    
    # Extract time data (hour of day)
    hours = [record.created_at.hour for record in sorted_records]
    
    # Count occurrences of each hour
    hour_counts = {}
    for hour in hours:
        hour_counts[hour] = hour_counts.get(hour, 0) + 1
    
    # Check if any hour has significantly more occurrences (suggesting scheduled task)
    max_count = max(hour_counts.values()) if hour_counts else 0
    return max_count >= 3  # At least 3 occurrences at same hour suggests pattern

def is_sustained_spike(spike_index: int, totals: List[float]) -> bool:
    """Determine if a spike is sustained or momentary"""
    if spike_index >= len(totals) - 1:
        return False  # Can't determine if it's the last point
    
    # Check if the traffic remains elevated after the spike
    spike_value = totals[spike_index]
    baseline = mean([v for i, v in enumerate(totals) if i != spike_index])
    
    # Calculate threshold for "elevated" (50% above baseline)
    elevated_threshold = baseline * 1.5
    
    # Check points after the spike
    points_after = [totals[i] for i in range(spike_index + 1, min(spike_index + 4, len(totals)))]
    
    # It's sustained if at least half of subsequent points remain elevated
    elevated_count = sum(1 for p in points_after if p > elevated_threshold)
    return elevated_count >= len(points_after) / 2 if points_after else False

@app.get("/")
def read_root():
    return {"message": "Welcome to the Traffic Classification API"}

@app.post("/bandwidth/", response_model=BandwidthResponse)
def create_bandwidth_record(bandwidth: BandwidthCreate, db: Session = Depends(get_db)):
    db_bandwidth = Bandwidth(
        device_id=bandwidth.device_id,
        upload=bandwidth.upload,
        download=bandwidth.download
    )
    db.add(db_bandwidth)
    db.commit()
    db.refresh(db_bandwidth)
    return db_bandwidth

@app.get("/bandwidth/", response_model=List[BandwidthResponse])
def read_bandwidth_records(
    skip: int = 0, 
    limit: int = 100, 
    device_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Bandwidth)
    if device_id:
        query = query.filter(Bandwidth.device_id == device_id)
    return query.offset(skip).limit(limit).all()

@app.get("/bandwidth/{bandwidth_id}", response_model=BandwidthResponse)
def read_bandwidth_record(bandwidth_id: int, db: Session = Depends(get_db)):
    db_bandwidth = db.query(Bandwidth).filter(Bandwidth.bandwidth == bandwidth_id).first()
    if db_bandwidth is None:
        raise HTTPException(status_code=404, detail="Bandwidth record not found")
    return db_bandwidth

@app.delete("/bandwidth/{bandwidth_id}")
def delete_bandwidth_record(bandwidth_id: int, db: Session = Depends(get_db)):
    db_bandwidth = db.query(Bandwidth).filter(Bandwidth.bandwidth == bandwidth_id).first()
    if db_bandwidth is None:
        raise HTTPException(status_code=404, detail="Bandwidth record not found")
    db.delete(db_bandwidth)
    db.commit()
    return {"message": "Bandwidth record deleted successfully"}

@app.get("/traffic/classify/{device_id}", response_model=TrafficClassification)
def classify_device_traffic(device_id: int, db: Session = Depends(get_db)):
    latest_record = db.query(Bandwidth).filter(Bandwidth.device_id == device_id).order_by(Bandwidth.created_at.desc()).first()
    
    if latest_record is None:
        raise HTTPException(status_code=404, detail=f"No bandwidth data found for device {device_id}")
    
    classification = classify_traffic(latest_record.upload, latest_record.download)
    total_usage = latest_record.upload + latest_record.download
    
    return {
        "device_id": device_id,
        "classification": classification,
        "upload": latest_record.upload,
        "download": latest_record.download,
        "total_usage": total_usage,
        "timestamp": latest_record.created_at
    }

@app.get("/traffic/stats/{device_id}")
def get_device_traffic_stats(
    device_id: int, 
    period: str = Query("day", description="Time period for stats: 'hour', 'day', 'week', 'month'"),
    db: Session = Depends(get_db)
):
    # Define time period
    now = datetime.now()
    if period == "hour":
        start_time = now - timedelta(hours=1)
    elif period == "day":
        start_time = now - timedelta(days=1)
    elif period == "week":
        start_time = now - timedelta(weeks=1)
    elif period == "month":
        start_time = now - timedelta(days=30)
    else:
        raise HTTPException(status_code=400, detail="Invalid period. Choose 'hour', 'day', 'week', or 'month'")
    
    # Get records within time period
    records = db.query(Bandwidth).filter(
        Bandwidth.device_id == device_id,
        Bandwidth.created_at >= start_time
    ).all()
    
    if not records:
        raise HTTPException(status_code=404, detail=f"No data found for device {device_id} in the specified period")
    
    # Calculate stats
    total_upload = sum(record.upload for record in records)
    total_download = sum(record.download for record in records)
    total_usage = total_upload + total_download
    avg_upload = total_upload / len(records) if records else 0
    avg_download = total_download / len(records) if records else 0
    
    record_count = len(records)
    classifications = {
        "LOW": 0,
        "MEDIUM": 0,
        "HIGH": 0
    }
    
    for record in records:
        classification = classify_traffic(record.upload, record.download)
        classifications[classification] += 1
    
    # Calculate percentages
    classification_percentages = {
        k: (v / record_count * 100) if record_count > 0 else 0 
        for k, v in classifications.items()
    }
    
    # Determine dominant classification
    dominant_classification = max(classifications, key=classifications.get)
    
    return {
        "device_id": device_id,
        "period": period,
        "total_records": record_count,
        "total_upload_mb": total_upload,
        "total_download_mb": total_download,
        "total_bandwidth_mb": total_usage,
        "average_upload_mb": avg_upload,
        "average_download_mb": avg_download,
        "classifications": classifications,
        "classification_percentages": classification_percentages,
        "dominant_classification": dominant_classification
    }

@app.get("/traffic/spike-analysis/{device_id}", response_model=SpikeAnalysisResult)
def analyze_device_traffic_spike(
    device_id: int, 
    timeframe: int = Query(24, description="Timeframe in hours to analyze for spikes (default: 24)"),
    db: Session = Depends(get_db)
):
    # Calculate the start time based on timeframe
    start_time = datetime.now() - timedelta(hours=timeframe)
    
    # Get records within time period
    records = db.query(Bandwidth).filter(
        Bandwidth.device_id == device_id,
        Bandwidth.created_at >= start_time
    ).order_by(Bandwidth.created_at).all()
    
    if not records:
        raise HTTPException(
            status_code=404, 
            detail=f"No data found for device {device_id} in the specified timeframe of {timeframe} hours"
        )
    
    # Perform spike analysis
    analysis_result = analyze_traffic_spike(device_id, records, timeframe)
    return analysis_result

@app.get("/traffic/spike-analysis")
def analyze_all_devices_traffic_spikes(
    timeframe: int = Query(24, description="Timeframe in hours to analyze for spikes (default: 24)"),
    threshold_percentage: float = Query(100.0, description="Minimum percentage increase to report as spike"),
    db: Session = Depends(get_db)
):
    # Calculate the start time based on timeframe
    start_time = datetime.now() - timedelta(hours=timeframe)
    
    # Get all unique device IDs with data in the timeframe
    device_ids = [r[0] for r in db.query(Bandwidth.device_id).filter(
        Bandwidth.created_at >= start_time
    ).distinct().all()]
    
    if not device_ids:
        return {"message": "No devices with data in the specified timeframe", "devices": []}
    
    # Analyze each device
    results = []
    for device_id in device_ids:
        records = db.query(Bandwidth).filter(
            Bandwidth.device_id == device_id,
            Bandwidth.created_at >= start_time
        ).order_by(Bandwidth.created_at).all()
        
        if records:
            analysis = analyze_traffic_spike(device_id, records, timeframe)
            
            # Only include if it has a spike and meets the threshold
            if analysis.has_spike and (analysis.percentage_increase or 0) >= threshold_percentage:
                results.append(analysis)
    
    # Sort by percentage increase (highest first)
    results.sort(key=lambda x: x.percentage_increase or 0, reverse=True)
    
    return {
        "timeframe_hours": timeframe,
        "threshold_percentage": threshold_percentage,
        "total_devices_analyzed": len(device_ids),
        "devices_with_spikes": len(results),
        "spike_analysis": results
    }

if __name__ == "__main__":
    uvicorn.run("traffic:app", host="0.0.0.0", port=8003, reload=True)