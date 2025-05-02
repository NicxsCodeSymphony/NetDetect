from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from models.bandwidth import NetworkWithBandwidth, BandwidthData, TotalBandwidth, DeviceBandwidthSummary
from services.bandwidth import BandwidthService

router = APIRouter(
    prefix="/api/bandwidth",
    tags=["Networks"]
)

@router.get("/", response_model=List[NetworkWithBandwidth])
async def get_all_networks():
    return BandwidthService.get_all_networks()

@router.get("/total", response_model=TotalBandwidth)
async def get_total_bandwidth():
    return BandwidthService.get_total_bandwidth_usage()\
    


@router.get("/latest", response_model=List[BandwidthData])
async def get_latest_bandwidth():
    return BandwidthService.get_latest_bandwidth()

@router.get("/device/{device_id}", response_model=List[BandwidthData])
async def get_device_bandwidth(device_id: int):
    return BandwidthService.get_device_bandwidth(device_id)

