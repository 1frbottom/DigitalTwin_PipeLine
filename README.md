# 공개 데이터 기반 실시간 교통정보 동기화 파이프라인

<br>

## **1. 프로젝트 개요**

### 배경
- 현재 디지털 트윈 기술은 시각적 가시화(Unity, Unreal)에 집중되어 있어, 현실 데이터와의 동기화가 미비한 실정입니다.<br><br>
- 본 프로젝트는 이 문제를 개선하고자 하는 목적에서 **공공 데이터를 실시간으로 수집, 가공하여 가상 공간(DB)으로 동기화하는 데이터 파이프라인**을 개발하였습니다.<br><br>

### 개발 목표
- 여러 타입 데이터(CCTV, 교통, 유동인구 등)의 실시간 수집 및 동기화 기술 개발<br><br>

### 핵심 성과
- 데이터 발생부터 적재까지 평균 레이턴시 **1.2초~1.8초** 달성 및 확장성 보장<br><br>

### 기여
- 디지털 트윈의 핵심인 '실시간성(Real-time)' 확보 및 동기화 상태를 판단하는 실시간율 로직 도입<br><br><br>

## **2. 시스템 아키텍처**
<img width="1222" height="670" alt="image" src="https://github.com/user-attachments/assets/6be6be4b-c28c-4352-9451-7fdfe8dfaf2a" /><br><br>

1.  Data Ingestion (Producer)
	- 서울시 열린 데이터 광장 API, Google Maps API 등에서 데이터를 비동기적으로 수집<br>
	
2.  Message Broker (Kafka)
	- 대용량 트래픽 처리를 위한 버퍼링 및 데이터 유실 방지<br>

3.  Stream Processing (Spark)
	- Kafka 스트림을 구독하여 파싱, 필터링, 포맷팅 수행 (ETL)<br>

4.  Storage (PostgreSQL)
	- 시계열 및 공간 데이터 적재<br>
	
5.  Service (FastAPI & Frontend)
	- 적재된 데이터를 시각화하고 모니터링하는 대시보드 제공<br><br>

_<small>전체 시스템은 Docker Container 환경에서 MSA(Microservice Architecture)와 유사한 구조로 동작합니다.</small>_<br><br>

## 3. 기술 스택

**Infra & DevOps**<br>
	- Docker : 컨테이너 기반 환경 격리 및 배포<br>
	
**Data Engineering**<br>
	- Apache Kafka & Spark : 실시간 스트리밍 데이터 파이프라인 구축 <br>
	
**Backend**<br>
	- Python, FastAPI : 비동기 API 서버 및 데이터 프로듀서 구현 <br>
	
**DBMS**<br>
	- PostgreSQL : 관계형 데이터베이스 및 시공간 데이터 저장 <br>
	
**Frontend**<br>
	- HTML/JS/CSS : 실시간 데이터 모니터링 대시보드 <br><br>

## 4. 설치 및 실행 (개발자용)

- 프론트 제외 전부 도커 컨테이너 위에서 동작합니다.<br><br>

- producer_asdf.py (데이터 생성, api별로 존재) -><br><br>
		spark (데이터 가공 / processor.py) -><br><br>
		spark (데이터 저장 및 조회 / postgres DB) -><br><br>
		api_server (api called) -><br><br>
		front_end (api caller)<br><br>

- 사용법<br>
	- 프로젝트 클론 후 본인 브랜치로 체크아웃<br><br>

	- 패치(patch)로 커밋목록 최신화 및 확인<br><br>

	- 루트에 .env 파일을 만들고 아래 붙여넣기<br>
		```
		# 서울 열린데이터 광장 (https://data.seoul.go.kr)
		SEOUL_API_KEY=

		# Google Cloud Maps API Key
		GOOGLE_MAPS_API_KEY=

		# 1. API Server
		HOST_PORT_API=58000

		# 2. Kafka External
		HOST_PORT_KAFKA=59092

		# 3. PostgreSQL
		HOST_PORT_DB=54320

		# 4. Spark Master UI
		HOST_PORT_SPARK_UI=58080
		```
		<br>

	- 프로젝트의 루트 디렉토리에서 터미널 실행 & 도커 데스크탑 앱 실행<br><br>

	- [terminal] docker compose up -d<br><br>

	- [docker app] 여러 컨테이너들에 불이 잘 들어와있나 체크 (kafka-setup은 실행 몇초 후 꺼지는게 정상)<br><br>

	- [docker app] (프론트는 바로 html 열어서 봐도 됩니다. 필요한 경우에) db 컨테이너의 exec으로 가서 아래의 명령어 입력<br>
		```
		psql -U user -d traffic_db

		\dt

		SELECT * FROM 테이블명 LIMIT 10;
		
		\q
		```
		<br>

	- [terminal] docker compose down<br><br>

	- .yml이나 .sql 등 코어 소스가 아닌 이상 compose 올려놓고 작업해도 바로바로 반영 됩니다.<br><br>

	- 다만 볼륨( db의 테이블 및 튜플들 등 )같은경우는 자주 지웠다 썼다 하는경우가 많으니 이경우는 docker compose down -v 와 docker compose up --build -d 를 자주 사용합니다.<br><br>

	- 아예 초기화는 docker system prune --all --volumes<br><br>

	- api 지역 바꿀 경우<br>
		```
		1. producer_city_data의 TARGET_AREAS에 원하는 지역 추가
		
		2. js파일의 TARGET_AREA_NAME을 원하는 지역으로 변경

		3. producer 컨테이너 재시작(docker compose restart producer) 후 1~2분 대기

		4. 대시보드 새로고침

		5. 필요시 api 응답 확인(curl "http://localhost:58000/city/events/cultural?area_name=지역명"),
			DB 체크(SELECT COUNT(*) FROM 테이블명 WHERE area_nm='지역명';)
		```
		<br>


- 발생할만한 에러 및 트러블슈팅<br>
	- 각 컨테이너의 로그에 port 관련 문제가 찍혀있는 경우, .env의 포트를 바꿔서 시도해보세요.<br><br>
	- back_end/start_producers.sh 파일이 윈도우 기반 CRLF로 되어있는 경우 도커가 작동하지 않으니 LF로 바꿔줘야 합니다.<br><br>
	- producer에서 api xml 태그 줄때 대소문자 뭐가맞는지 확인 필요, 서울 열린데이터는 소문자.<br><br>
	- producer - spark 간에 레이스컨디션때문에 아예 못받아올 수 있음, 켜진상태로 producer를 재시작해보고 확인.<br><br>
	- API의 response 원문이 깨져서 오는경우도 간혹 있으니 원문 확인 필요.<br><br>
