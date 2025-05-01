import mysql.connector
from mysql.connector import Error
from fastapi import HTTPException

class BandwidthService:
    @staticmethod
    def get_latest_bandwidth():
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
                SELECT b.* 
                FROM bandwidth b
                INNER JOIN (
                    SELECT device_id, MAX(created_at) as max_date
                    FROM bandwidth
                    GROUP BY device_id
                ) m ON b.device_id = m.device_id AND b.created_at = m.max_date
                """
                cursor.execute(query)
                
                result = cursor.fetchall()
                
                cursor.close()
                connection.close()
                
                return result
            
        except Error as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve bandwidth data: {str(e)}")
            
    @staticmethod
    def get_device_bandwidth(device_id: int):
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
                SELECT * FROM bandwidth
                WHERE device_id = %s
                ORDER BY created_at DESC
                LIMIT 100
                """
                cursor.execute(query, (device_id,))
                
                result = cursor.fetchall()
                
                cursor.close()
                connection.close()
                
                return result
            
        except Error as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve bandwidth data: {str(e)}")
    
    @staticmethod
    def get_total_bandwidth_usage():
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
                    SUM(upload) as total_upload,
                    SUM(download) as total_download,
                    SUM(upload + download) as total_usage
                FROM bandwidth
                """
                cursor.execute(query)
                
                result = cursor.fetchone()
                
                cursor.close()
                connection.close()
                
                return result
            
        except Error as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve total bandwidth data: {str(e)}")
    
    @staticmethod
    def get_bandwidth_by_device():
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
                    device_id,
                    SUM(upload) as total_upload,
                    SUM(download) as total_download,
                    SUM(upload + download) as total_usage
                FROM bandwidth
                GROUP BY device_id
                """
                cursor.execute(query)
                
                result = cursor.fetchall()
                
                cursor.close()
                connection.close()
                
                return result
            
        except Error as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve bandwidth by device: {str(e)}")
    
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
                
                networks_query = "SELECT * FROM networks"
                cursor.execute(networks_query)
                networks = cursor.fetchall()
                
                latest_bandwidth_query = """
                SELECT b.* 
                FROM bandwidth b
                INNER JOIN (
                    SELECT device_id, MAX(created_at) as max_date
                    FROM bandwidth
                    GROUP BY device_id
                ) m ON b.device_id = m.device_id AND b.created_at = m.max_date
                """
                cursor.execute(latest_bandwidth_query)
                bandwidth_data = cursor.fetchall()
                
                bandwidth_dict = {item['device_id']: item for item in bandwidth_data}
                
                for network in networks:
                    network_id = network['id']
                    if network_id in bandwidth_dict:
                        bw = bandwidth_dict[network_id]
                        network['bandwidth'] = bw['bandwidth']
                        network['upload'] = bw['upload']
                        network['download'] = bw['download']
                        network['bandwidth_created_at'] = bw['created_at']
                    else:
                        network['bandwidth'] = None
                        network['upload'] = None
                        network['download'] = None
                        network['bandwidth_created_at'] = None
                
                cursor.close()
                connection.close()
                
                return networks
            
        except Error as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve network data: {str(e)}")