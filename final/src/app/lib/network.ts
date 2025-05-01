export interface Networks{
    id: number;
    ip_address: string;
    mac_address: string;
    hostname: string;
    manufacturer: string;
    whitelist: number;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface NetworkWithBandwidth{
    id: number;
    ip_address: string;
    mac_address: string;
    hostname: string;
    manufacturer: string;
    whitelist: number;
    device_type: string;
    status: string;
    created_at: string;
    updated_at: string;
    download: number;
    upload: number;
    bandwidth_timestamp: string;
}


export interface UnblockProp{
    id: number;
    status: string;
}

