from fastapi import FastAPI
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from routes import network_route, bandwidth_route, notification_route

app = FastAPI(title="NetDetect API", description="API for retrieving network data")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(network_route.router)
app.include_router(bandwidth_route.router)
app.include_router(notification_route.router)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8020, reload=True)