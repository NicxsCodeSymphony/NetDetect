# api/routes/network_route.py
from fastapi import APIRouter, HTTPException, Path
from typing import List
from models.network import NetworkData, NetworkDataWithBandwidth
from services.network import NetworkService

router = APIRouter(
    prefix="/api/networks",
    tags=["Networks"]
)

@router.get("", response_model=List[NetworkData]) 
async def get_all_networks():
    return NetworkService.get_all_networks()

@router.get("/blocked", response_model=List[NetworkData])
async def get_all_blocked_devices():
    return NetworkService.get_all_blocked_devices()

@router.get("/bandwidths", response_model=List[NetworkData]) 
async def get_all_networks():
    return NetworkService.get_all_networks()

@router.put("/{network_id}/status/online")
async def set_network_status_online(network_id: int = Path(..., description="The ID of the network to set online")):
    return NetworkService.set_network_status_online(network_id)