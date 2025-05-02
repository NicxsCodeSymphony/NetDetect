"use client"

import React, {useState} from "react"
import type { Prediction } from "./prediction"
import axios from "axios"

export const fetchPrediction = async (): Promise<Prediction[]> => {
    try{
        const res = await axios.get<Prediction[]>("http://127.0.0.1:8004/predict-all")
        return res.data
    }
    catch(err){
        return []
    }
}