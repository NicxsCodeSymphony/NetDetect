# api/models/network.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class NetworkData(BaseModel):
    id: int
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    hostname: Optional[str] = None
    manufacturer: Optional[str] = None
    device_type: Optional[str] = None
    whitelist: Optional[bool] = False
    status: Optional[str] = "Active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True