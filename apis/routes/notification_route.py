from fastapi import APIRouter, HTTPException
from typing import List
from models.notification import NotificationData
from services.notification import NotificationService

router = APIRouter(
    prefix="/api/notification",
    tags=['Networks']
)

@router.get("", response_model=List[NotificationData])
async def get_all_notification():
    return NotificationService.get_all_notification() 