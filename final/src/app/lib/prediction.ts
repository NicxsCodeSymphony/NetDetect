export interface Prediction{
    device_id: number;
    predicted_upload: number;
    predicted_download: number;
    confidence_score: number;
    hostname: string;
}