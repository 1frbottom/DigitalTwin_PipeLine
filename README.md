# DigitalTwin_PipeLine<br><br>

- __현재 목표__<br><br>
	- back_end 폴더에서 실제 api 여러개 호출 및 저장, 프론트엔드까지 일련의 테스트중<br><br>


***

- 프로젝트 프로토타이핑 입니다.<br><br>

	- 전부 도커 컨테이너 위에서 동작합니다.<br><br>

	- producer_asdf.py(데이터 생성, api별로 존재) -><br>
			spark(데이터 가공 / processor.py) -><br>
			spark(데이터 저장 및 조회 / postgres DB) -><br><br>
			api_server(api called) -><br><br>
			front_end(api caller)<br><br>

- 사용법<br>
	- 프로젝트 클론 후 본인 브랜치로 체크아웃

	- 패치(patch)로 커밋목록 최신화 및 확인

	- 루트에 .env 파일을 만들고 "SEOUL_API_KEY=본인의 서울 열린데이터 api key" 한줄 입력후 저장<br><br>

	- 프로젝트의 루트 디렉토리에서 터미널 실행 & 도커 데스크탑 앱 실행<br><br>

	- [terminal] docker compose up -d<br><br>

	- [docker app] 여러 컨테이너들에 불이 잘 들어와있나 체크 (kafka-setup은 실행후 몇초후 꺼지는게 정상)<br><br>

	- [docker app] (프론트는 바로 html 열어서 봐도 됩니다. 필요한 경우에) db 컨테이너의 exec으로 가서 아래의 명령어 입력<br><br>
		- psql -U user -d traffic_db<br><br>
		- \dt
		- SELECT * FROM 테이블명 LIMIT 10;<br><br>
		- \q<br><br>

	- [terminal] docker compose down<br><br>

	- .yml이나 .sql 등 코어 소스가 아닌 이상 compose 올려놓고 작업해도 바로바로 반영 됩니다

	- 다만 볼륨( db의 테이블 및 그 튜플들 등등 )같은경우는 자주 지웠다 썼다 하는경우가 많으니,

	- 이런경우는 docker compose down -v 와 docker compose up --build -d 를 자주 사용합니다.

	- 아예 초기화는 docker system prune --all --volumes

- 발생할만한 에러 및 트러블슈팅<br>
	- 각 컨테이너의 로그에 port 관련 문제가 찍혀있는 경우, 프로젝트 루트의 .yml 파일에서 문제되는 컨테이너의 포트를 바꾸면 해결될 가능성이 높습니다.<br><br>
	- back_end/start_producers.sh 파일이 윈도우 기반 CRLF로 되어있는 경우 도커가 작동하지 않으니 LF로 바꿔줘야 합니다.<br><br>
	- producer에서 api xml 태그 줄때 대소문자 뭐가맞는지 확인 필요, 서울 열린데이터는 소문자
	- producer - spark 간에 레이스컨디션때문에 아예 못받아올 수 있음, 켜진상태로 producer를 재시작해보고 확인 ( 일단 해결됨 )
	- API의 response 원문이 깨져서 오는경우도 간혹 있으니 원문 확인 필요