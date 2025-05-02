import mysql.connector
from mysql.connector import Error
from fastapi import HTTPException

class NotificationService:
    @staticmethod
    def get_all_notification():
        try:
            connection = mysql.connector.connect(
                host="localhost",
                user="root",
                password="goldfish123",
                database="netdetect"
            )
            if connection.is_connected():
                cursor = connection.cursor(dictionary=True)

                query = "SELECT * FROM notification ORDER BY created_at DESC LIMIT 200"
                cursor.execute(query)

                result = cursor.fetchall()

                cursor.close()
                connection.close()

                return result
        
        except Error as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve network data: {str(e)}")