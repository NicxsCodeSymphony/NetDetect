export interface Bandwidths{
    bandwidth: number;
    device_id: number;
    upload: number;
    download: number
    created_at: string
}

export interface TotalBandWidth{
    total_download: number;
    total_upload: number;
    total_usage: number
}