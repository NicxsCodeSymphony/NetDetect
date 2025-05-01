import axios from "axios"
import type { Networks, NetworkWithBandwidth, UnblockProp } from "./network"

const url = "https://netdetect-api.vercel.app/networks/"

export const fetchNetworks = async (): Promise<Networks[]> =>{
    try{
        const res = await axios.get<Networks[]>(`${url}`)
        return res.data
    }
    catch(err){
        console.error("Failed to fetch networks: ", err)
        return []
    }
}

export const fetchNetworksWithBandwidth = async (): Promise<NetworkWithBandwidth[]> => {
    try{
        const res = await axios.get<NetworkWithBandwidth[]>(`${url}bandwidths`)
        return res.data
    }
    catch(err){
        console.error("Failed to fetch network with bandwidth: ", err)
        return []
    }
}


export const blockedNetworks = async(): Promise<Networks[]> => {
    try{
        const res = await axios.get<Networks[]>(`${url}blocked`)
        return res.data
    }
    catch(err){
        console.error("Failed to fetch blocked networks: ", err)
        return []
    }
}

export const unblockNetwork = async(id: number): Promise<UnblockProp[]> => {
    try{
        const res = await axios.put<UnblockProp[]>(`${url}unblock/${id}`)
        return res.data
    }
    catch(err){
        console.error("Failed to unblock network: ", err)
        return []
    }
}
