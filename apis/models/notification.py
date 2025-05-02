from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class NotificationData(BaseModel):
    noti_id: int
    device_id: int
    types: Optional[str] = None
    remarks: Optional[str] = None
    severity: Optional[int] = None
    created_at: Optional[datetime] = None

