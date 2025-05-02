import axios from "axios";
import type { Bandwidths, TotalBandWidth } from "./bandwidth";

// const url = "https://netdetect-api.vercel.app/bandwidth"
const url = "http://localhost:8020/api/bandwidth"

export const fetchBandwidth = async (): Promise<Bandwidths[]> => {
    try{
        const res = await axios.get<Bandwidths[]>(`${url}`)
        return res.data
    }
    catch(err){
        console.error("Failed to fetch bandwidth data: ", err)
        return []
    }
}

export const fetchBandwidthById = async (id: number): Promise<Bandwidths[]> => {
    try{
        const res = await axios.get<Bandwidths[]>(`${url}/device/${id}`)
        return res.data
    }
    catch(err){
        console.error("Failed to fetch bandwidth data: ", err)
        return []
    }
}


export const fetchTotalBandwidth = async (): Promise<TotalBandWidth> => {
    try {
        const res = await axios.get<TotalBandWidth>(`${url}/total`)
        return res.data
    } catch (err) {
        console.error("Failed to fetch total bandwidth: ", err)
        return {} as TotalBandWidth 
    }
}
