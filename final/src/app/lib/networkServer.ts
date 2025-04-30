import axios from "axios"
import type { Networks } from "./network"

const url = "http://localhost:8000/api/networks/"

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