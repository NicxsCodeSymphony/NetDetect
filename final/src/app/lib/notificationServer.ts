import type { Notification } from "./notification"
import axios from "axios"

const url = "http://localhost:3002/notification"

export const getNotification = async(): Promise<Notification[]> => {
    try{
        const res = await axios.get<Notification[]>(`${url}`)
        return res.data
    }
    catch(err){
        console.error("Failed to fetch notifications: ", err)
        return []
    }
}