from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from models.bandwidth import NetworkWithBandwidth, BandwidthData, TotalBandwidth, DeviceBandwidthSummary
from services.bandwidth import BandwidthService

router = APIRouter(
    prefix="/api/networks",
    tags=["Networks"]
)

@router.get("/bandwidth", response_model=List[NetworkWithBandwidth])
async def get_all_networks():
    return BandwidthService.get_all_networks()

@router.get("/bandwidth/total", response_model=TotalBandwidth)
async def get_total_bandwidth():
    return BandwidthService.get_total_bandwidth_usage()

@router.get("/bandwidth/by-device", response_model=List[DeviceBandwidthSummary])
async def get_bandwidth_by_device():
    return BandwidthService.get_bandwidth_by_device()

@router.get("/bandwidth/latest", response_model=List[BandwidthData])
async def get_latest_bandwidth():
    return BandwidthService.get_latest_bandwidth()

@router.get("/bandwidth/device/{device_id}", response_model=List[BandwidthData])
async def get_device_bandwidth(device_id: int):
    return BandwidthService.get_device_bandwidth(device_id)