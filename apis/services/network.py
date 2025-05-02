# api/services/network.py
import mysql.connector
from mysql.connector import Error
from fastapi import HTTPException

class NetworkService:
    @staticmethod
    def get_all_networks():
        try:
            connection = mysql.connector.connect(
                host="localhost",
                user="root",
                password="goldfish123",
                database="netdetect"
            )
            
            if connection.is_connected():
                cursor = connection.cursor(dictionary=True)
                
                query = "SELECT * FROM networks"
                cursor.execute(query)
                
                result = cursor.fetchall()
                
                cursor.close()
                connection.close()
                
                return result
            
        except Error as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve network data: {str(e)}")
        
    @staticmethod
    def get_all_blocked_devices():
        try:
            connection = mysql.connector.connect(
                host="localhost",
                user="root",
                password="goldfish123",
                database="netdetect"
            )
            
            if connection.is_connected():
                cursor = connection.cursor(dictionary=True)
                
                query = "SELECT * FROM networks WHERE status = 'blocked'"
                cursor.execute(query)
                
                result = cursor.fetchall()
                
                cursor.close()
                connection.close()
                
                return result
            
        except Error as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve network data: {str(e)}")
        

    @staticmethod
    def get_network_width_bandwidth():
        try:
            connection = mysql.connector.connect(
                host="localhost",
                user="root",
                password="goldfish123",
                database="netdetect"
            )
            
            if connection.is_connected():
                cursor = connection.cursor(dictionary=True)
                
                query = """
                    SELECT 
                    n.*, 
                    b.upload, 
                    b.download,
                    b.created_at AS bandwidth_timestamp
                FROM networks n
                LEFT JOIN (
                    SELECT b1.*
                    FROM bandwidth b1
                    JOIN (
                    SELECT device_id, MAX(created_at) AS latest_time
                    FROM bandwidth
                    GROUP BY device_id
                    ) latest
                    ON b1.device_id = latest.device_id AND b1.created_at = latest.latest_time
                ) b
                ON n.id = b.device_id
                """
                cursor.execute(query)
                
                result = cursor.fetchall()
                
                cursor.close()
                connection.close()
                
                return result
            
        except Error as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve bandwidth by device: {str(e)}")
        
    @staticmethod
    def set_network_status_online(network_id: int):
        try:
            connection = mysql.connector.connect(
                host="localhost",
                user="root",
                password="goldfish123",
                database="netdetect"
            )

            if connection.is_connected():
                cursor = connection.cursor()

                query = "UPDATE networks SET status = 'online' WHERE id = %s"
                cursor.execute(query, (network_id,))
                connection.commit()

                cursor.close()
                connection.close()

                return {"message": "Network status updated to online."}

        except Error as e:
            raise HTTPException(status_code=500, detail=f"Failed to update network status: {str(e)}")