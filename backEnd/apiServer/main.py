from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import traffic, cctv, city_rt

app = FastAPI(
    title="디지털 트윈 교통 데이터 API",
    description="실시간 교통/CCTV/돌발상황 정보 조회 API",
    version="1.0.0"
)

# CORS 설정 (프론트엔드 연동용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(traffic.router)
app.include_router(cctv.router)
app.include_router(city_rt.router)

@app.get("/")
def read_root():
    return {"message": "교통 데이터 API 서버입니다"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
