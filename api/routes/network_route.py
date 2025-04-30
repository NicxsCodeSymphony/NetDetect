# api/routes/network_route.py
from fastapi import APIRouter, HTTPException
from typing import List
from models.network import NetworkData
from services.network import NetworkService

router = APIRouter(
    prefix="/api/networks",
    tags=["Networks"]
)

@router.get("", response_model=List[NetworkData]) 
async def get_all_networks():
    """
    Retrieve all records from the networks table
    """
    return NetworkService.get_all_networks()