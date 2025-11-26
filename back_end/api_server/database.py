from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# PostgreSQL 연결 정보
# 기본값은 docker-compose 환경 (hostname: db)
# 로컬 실행 시 DATABASE_URL 환경변수로 오버라이드 가능
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/traffic_db")

engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 의존성 주입용 DB 세션 생성 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
