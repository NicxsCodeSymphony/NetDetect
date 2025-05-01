from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class BandwidthData(BaseModel):
    bandwidth: int
    device_id: int
    upload: float
    download: float
    created_at: datetime

class NetworkWithBandwidth(BaseModel):
    id: int
    ip_address: str
    mac_address: str
    hostname: str
    manufacturer: Optional[str] = ""
    device_type: Optional[str] = ""
    whitelist: Optional[int] = 0
    status: Optional[str] = "offline"
    created_at: Optional[datetime] = None
    bandwidth: Optional[int] = None
    upload: Optional[float] = None
    download: Optional[float] = None
    bandwidth_created_at: Optional[datetime] = None

class TotalBandwidth(BaseModel):
    total_upload: float
    total_download: float
    total_usage: float

class DeviceBandwidthSummary(BaseModel):
    device_id: int
    total_upload: float
    total_download: float
    total_usage: float