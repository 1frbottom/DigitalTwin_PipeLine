// ========================================
// 설정
// ========================================
const CONFIG = {
    AUTO_LOAD_CCTV: true,  // CCTV 자동 로드 (false로 변경하면 비활성화)
    AUTO_PLAY_CCTV: true   // CCTV 자동 재생 (false로 변경하면 비활성화)
};

// const API_BASE_URL = `http://${window.location.hostname}:8000`;
const API_BASE_URL = `http://localhost:8000`;

async function fetchAPI(endpoint, params = {}) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${API_BASE_URL}${endpoint}?${queryString}` : `${API_BASE_URL}${endpoint}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        return { status: response.status, data };
    } catch (error) {
        return { status: 'error', error: error.message };
    }
}

// 1. 헬스 체크
async function getHealth() {
    const resultDiv = document.getElementById('health-response');
    const statusDiv = document.getElementById('health-status');
    
    resultDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    statusDiv.innerHTML = '로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';
    
    const result = await fetchAPI('/health');
    
    if (result.status === 200) {
        statusDiv.innerHTML = '서버 정상';
        statusDiv.className = 'status success';
        resultDiv.innerHTML = `<span class="success">${JSON.stringify(result.data, null, 2)}</span>`;
    } else {
        statusDiv.innerHTML = '서버 오류';
        statusDiv.className = 'status error';
        resultDiv.innerHTML = `<span class="error">Error: ${result.error}</span>`;
    }
}

// 2. CCTV 스트리밍
async function loadCCTVStreams() {
    const statusDiv = document.getElementById('cctv-status');

    statusDiv.innerHTML = '⏳ 로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';

    const result = await fetchAPI('/cctv/streams');

    if (result.status === 200) {
        statusDiv.innerHTML = '✅ 성공';
        statusDiv.className = 'status success';

        const streams = result.data.data; 

        streams.forEach((stream, i) => {
            const video = document.getElementById(`cctv${i + 1}`);
            const name = document.getElementById(`cctv${i + 1}-name`);

            if (name) name.textContent = stream.name;

            if (!video) return;

            // HLS.js 지원 (Chrome, Firefox, Edge 등)
            if (Hls.isSupported()) {
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,          
                    backBufferLength: 10,         
                    maxBufferLength: 10,           
                    maxMaxBufferLength: 20,        
                    liveSyncDurationCount: 3,      
                    liveMaxLatencyDurationCount: 5 
                });

                hls.loadSource(stream.stream_url);
                hls.attachMedia(video);

                hls.on(Hls.Events.MANIFEST_PARSED, function() {
                    console.log(`CCTV ${i + 1} (${stream.name}): 스트림 준비 완료`);

                    if (hls.liveSyncPosition) {
                        video.currentTime = hls.liveSyncPosition;
                    }
                    // hls 지원 자동 재생 
                    if (CONFIG.AUTO_PLAY_CCTV) {
                        video.play().catch(function(error) {
                            console.log(`CCTV ${i + 1} 자동 재생 실패:`, error.message);
                        });
                    }
                });

                hls.on(Hls.Events.ERROR, function(event, data) {
                    if (data.fatal) {
                        console.error(`CCTV ${i + 1} 에러:`, data);
                        switch(data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.log('네트워크 에러, 재시도 중...');
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.log('미디어 에러, 복구 시도 중...');
                                hls.recoverMediaError();
                                break;
                            default:
                                console.log('치명적 에러, 재생 불가');
                                break;
                        }
                    }
                });
            }
            // macOS, iOS, iPadOS의 Safari 브라우저에서 작동
            else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = stream.stream_url;

                video.addEventListener('loadedmetadata', function() {
                    console.log(`CCTV ${i + 1} (${stream.name}): Safari 네이티브 HLS 로드 완료`);

                    if (CONFIG.AUTO_PLAY_CCTV) {
                        video.play().catch(function(error) {
                            console.log(`CCTV ${i + 1} 자동 재생 실패:`, error.message);
                        });
                    }
                });

                video.addEventListener('error', function(e) {
                    console.error(`CCTV ${i + 1} Safari 재생 에러:`, e);
                });
            }
            // HLS 미지원 브라우저
            else {
                console.error(`CCTV ${i + 1}: HLS 재생을 지원하지 않는 브라우저입니다.`);
                if (name) name.textContent = `${stream.name} (미지원)`;
            }
        });
    } else {
        statusDiv.innerHTML = '❌ 실패';
        statusDiv.className = 'status error';
        console.error('Error:', result.error || result.data);
    }
}

// 3. 실시간 도시 데이터 - 인구 현황 (LIVE_PPLTN_STTS)
async function getCityPopulationCurrent() {
    const resultDiv = document.getElementById('city-current-response');
    const statusDiv = document.getElementById('city-current-status');
    const areaName = document.getElementById('areaName').value;

    if (!areaName) {
        alert('지역명을 입력하세요');
        return;
    }

    resultDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    resultDiv.style.display = 'block'; // 숨겨진 박스 표시
    statusDiv.innerHTML = '로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';

    // FastAPI 라우터(router_city.py)에서 정의한 쿼리 파라미터 'area_name'
    const result = await fetchAPI('/city/population/current', { area_name: areaName });

    if (result.status === 200) {
        statusDiv.innerHTML = '성공';
        statusDiv.className = 'status success';
        resultDiv.innerHTML = `<span class="success">데이터 수신 완료</span>\n\n${JSON.stringify(result.data, null, 2)}`;
    } else {
        statusDiv.innerHTML = '실패';
        statusDiv.className = 'status error';
        resultDiv.innerHTML = `<span class="error">Error: ${result.error || JSON.stringify(result.data)}</span>`;
    }
}

// 3-1. 실시간 도시 데이터 - 인구 현황 - 인구 예측 (LIVE_PPLTN_STTS)
async function getCityPopulationForecast() {
    const resultDiv = document.getElementById('city-forecast-response');
    const tableDiv = document.getElementById('city-forecast-table');
    const statusDiv = document.getElementById('city-forecast-status');
    const areaName = document.getElementById('areaName').value;

    if (!areaName) {
        alert('지역명을 입력하세요');
        return;
    }

    resultDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    resultDiv.style.display = 'block'; // 숨겨진 박스 표시
    tableDiv.innerHTML = ''; // 기존 테이블 초기화
    statusDiv.innerHTML = '로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';

    // FastAPI 라우터(router_city.py)에서 정의한 쿼리 파라미터 'area_name'
    const result = await fetchAPI('/city/population/forecast', { area_name: areaName });

    if (result.status === 200) {
        statusDiv.innerHTML = '성공';
        statusDiv.className = 'status success';
        
        if (result.data.length === 0) {
            resultDiv.innerHTML = `<span class="success">데이터가 없습니다. (예측 데이터가 아직 없거나 지역명 오류)</span>`;
            return;
        }

        resultDiv.innerHTML = `<span class="success">데이터 개수: ${result.data.length}</span>\n\n${JSON.stringify(result.data, null, 2)}`;
        
        // 통계 테이블과 동일한 스타일로 테이블 생성
        let tableHTML = '<table><tr><th>기준 시각</th><th>예측 시각</th><th>혼잡도</th><th>최소 인구</th><th>최대 인구</th></tr>';
        
        result.data.forEach(item => {
            // 날짜/시간 포맷팅 (YYYY. MM. DD. HH:mm)
            const baseTime = new Date(item.base_ppltn_time).toLocaleString('ko-KR', { hour12: false });
            const fcstTime = new Date(item.fcst_time).toLocaleString('ko-KR', { hour12: false });

            tableHTML += `<tr>
                <td>${baseTime}</td>
                <td>${fcstTime}</td>
                <td>${item.fcst_congest_lvl}</td>
                <td>${item.fcst_min}</td>
                <td>${item.fcst_max}</td>
            </tr>`;
        });
        tableHTML += '</table>';
        tableDiv.innerHTML = tableHTML;

    } else {
        statusDiv.innerHTML = '실패';
        statusDiv.className = 'status error';
        resultDiv.innerHTML = `<span class="error">Error: ${result.error || JSON.stringify(result.data)}</span>`;
        tableDiv.innerHTML = '';
    }
}

// 4. 실시간 돌발 정보 조회
async function getActiveIncidents() {
    const resultDiv = document.getElementById('incident-response');
    const tableDiv = document.getElementById('incident-table');
    const statusDiv = document.getElementById('incident-status');

    // 초기화 및 로딩 표시
    resultDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    resultDiv.style.display = 'block';
    tableDiv.innerHTML = ''; 
    statusDiv.innerHTML = '로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';

    // API 호출
    const result = await fetchAPI('/incident/active');

    if (result.status === 200) {
        statusDiv.innerHTML = '성공';
        statusDiv.className = 'status success';

        // 데이터가 없는 경우 처리
        if (result.data.length === 0) {
            resultDiv.innerHTML = `<span class="success">현재 진행 중인 돌발 상황이 없습니다. (Clean)</span>`;
            return;
        }

        // 1. JSON 원본 표시
        resultDiv.innerHTML = `<span class="success">데이터 개수: ${result.data.length}</span>\n\n${JSON.stringify(result.data, null, 2)}`;

        // 2. 테이블 생성 (사용자가 보기 편하게)
        let tableHTML = '<table><tr><th>유형</th><th>상세 내용</th><th>위치(X, Y)</th><th>갱신 시간</th></tr>';
        
        result.data.forEach(item => {
            // Unix Timestamp -> 읽기 쉬운 시간 포맷 변환
            const timeStr = new Date(item.timestamp * 1000).toLocaleString('ko-KR', { hour12: false });
            
            tableHTML += `<tr>
                <td><span class="status error" style="background:rgba(255,0,0,0.1); color:red;">${item.acc_type || '기타'}</span></td>
                <td>${item.acc_info}</td>
                <td>${item.grs80tm_x}, ${item.grs80tm_y}</td>
                <td>${timeStr}</td>
            </tr>`;
        });
        tableHTML += '</table>';
        tableDiv.innerHTML = tableHTML;

    } else {
        statusDiv.innerHTML = '실패';
        statusDiv.className = 'status error';
        resultDiv.innerHTML = `<span class="error">Error: ${result.error || JSON.stringify(result.data)}</span>`;
        tableDiv.innerHTML = '';
    }
}

// 5. 실시간 도시 데이터 - 도로 소통 현황 (ROAD_TRAFFIC_STTS)
async function getCityRoadTraffic() {
    const resultDiv = document.getElementById('city-road-response');
    const tableDiv = document.getElementById('city-road-table');
    const statusDiv = document.getElementById('city-road-status');
    const areaName = document.getElementById('roadAreaName').value;

    if (!areaName) {
        alert('지역명을 입력하세요');
        return;
    }

    // 초기화
    resultDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    resultDiv.style.display = 'block';
    tableDiv.innerHTML = '';
    statusDiv.innerHTML = '로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';

    // API 호출
    const result = await fetchAPI('/city/traffic/road', { area_name: areaName });

    if (result.status === 200) {
        statusDiv.innerHTML = '성공';
        statusDiv.className = 'status success';
        resultDiv.innerHTML = `<span class="success">데이터 수신 완료</span>\n\n${JSON.stringify(result.data, null, 2)}`;

        // 테이블 생성
        const item = result.data;
        const timeStr = new Date(item.road_traffic_time).toLocaleString('ko-KR', { hour12: false });

        // 소통 상태에 따른 색상 클래스 (간단하게 구현)
        let statusClass = 'status';
        if (item.road_traffic_idx === '정체') statusClass += ' error';
        else if (item.road_traffic_idx === '서행') statusClass += ' loading'; // 노란색 계열 재사용
        else statusClass += ' success';

        let tableHTML = `
            <table>
                <tr>
                    <th style="width: 20%;">항목</th>
                    <th>내용</th>
                </tr>
                <tr>
                    <td>지역명</td>
                    <td>${item.area_nm}</td>
                </tr>
                <tr>
                    <td>소통 상태</td>
                    <td><span class="${statusClass}">${item.road_traffic_idx}</span></td>
                </tr>
                <tr>
                    <td>평균 속도</td>
                    <td><strong>${item.road_traffic_spd} km/h</strong></td>
                </tr>
                <tr>
                    <td>상세 메시지</td>
                    <td>${item.road_msg}</td>
                </tr>
                <tr>
                    <td>기준 시간</td>
                    <td>${timeStr}</td>
                </tr>
            </table>`;

        tableDiv.innerHTML = tableHTML;

    } else {
        statusDiv.innerHTML = '실패';
        statusDiv.className = 'status error';
        resultDiv.innerHTML = `<span class="error">Error: ${result.error || JSON.stringify(result.data)}</span>`;
        tableDiv.innerHTML = '';
    }
}

// 6. 지하철 실시간 도착 정보 현황판
async function getSubwayArrivalBoard() {
    const boardDiv = document.getElementById('subway-arrival-board');
    const statusDiv = document.getElementById('subway-arrival-status');
    const updatedDiv = document.getElementById('subway-arrival-updated');
    const areaName = document.getElementById('subwayAreaName').value;

    if (!areaName) {
        alert('지역명을 입력하세요');
        return;
    }

    // 초기화
    boardDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    updatedDiv.innerHTML = '';
    statusDiv.innerHTML = '로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';

    // API 호출
    const result = await fetchAPI('/subway/arrival/board', { area_name: areaName });

    if (result.status === 200) {
        statusDiv.innerHTML = '성공';
        statusDiv.className = 'status success';

        const data = result.data.data;
        const updatedAt = result.data.updated_at;

        // 데이터가 없는 경우
        if (!data || data.length === 0) {
            boardDiv.innerHTML = `<p style="color: var(--color-text-secondary);">현재 도착 예정인 열차가 없습니다.</p>`;
            return;
        }

        // 갱신 시점 표시 (YYYY. MM. DD. HH:mm:ss 형식)
        const date1 = new Date(updatedAt);
        const year1 = date1.getFullYear();
        const month1 = String(date1.getMonth() + 1).padStart(2, '0');
        const day1 = String(date1.getDate()).padStart(2, '0');
        const hours1 = String(date1.getHours()).padStart(2, '0');
        const minutes1 = String(date1.getMinutes()).padStart(2, '0');
        const seconds1 = String(date1.getSeconds()).padStart(2, '0');
        const updateTime = `${year1}. ${month1}. ${day1}. ${hours1}:${minutes1}:${seconds1}`;
        updatedDiv.innerHTML = `<strong>갱신 시점:</strong> ${updateTime}`;

        // 현황판 테이블 생성
        let boardHTML = `
            <div class="subway-board">
                <table class="subway-board-table">
                    <thead>
                        <tr>
                            <th>역명</th>
                            <th>호선</th>
                            <th>방향</th>
                            <th>도착 정보</th>
                        </tr>
                    </thead>
                    <tbody>`;

        data.forEach(item => {
            boardHTML += `
                <tr>
                    <td><strong>${item.station_nm}</strong></td>
                    <td><span class="subway-line line-${item.line_num}">${item.line_num}</span></td>
                    <td class="train-direction">${item.train_line_nm}</td>
                    <td class="arrival-info"><strong>${item.arrival_msg_1 || '-'}</strong></td>
                </tr>`;
        });

        boardHTML += `
                    </tbody>
                </table>
            </div>`;

        boardDiv.innerHTML = boardHTML;

    } else {
        statusDiv.innerHTML = '실패';
        statusDiv.className = 'status error';
        boardDiv.innerHTML = `<span class="error">Error: ${result.error || JSON.stringify(result.data)}</span>`;
        updatedDiv.innerHTML = '';
    }
}

// 7. 지하철 시간별 승하차 누적 현황
async function getSubwayPassengerCumulative() {
    const tableDiv = document.getElementById('subway-passenger-table');
    const statusDiv = document.getElementById('subway-passenger-status');
    const updatedDiv = document.getElementById('subway-passenger-updated');
    const areaName = document.getElementById('subwayPassengerAreaName').value;

    if (!areaName) {
        alert('지역명을 입력하세요');
        return;
    }

    // 초기화
    tableDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    updatedDiv.innerHTML = '';
    statusDiv.innerHTML = '로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';

    // API 호출
    const result = await fetchAPI('/subway/passenger/cumulative', { area_name: areaName });

    if (result.status === 200) {
        statusDiv.innerHTML = '성공';
        statusDiv.className = 'status success';

        const data = result.data.data;
        const updatedAt = result.data.updated_at;

        // 데이터가 없는 경우
        if (!data || data.length === 0) {
            tableDiv.innerHTML = `<p style="color: var(--color-text-secondary);">해당 지역의 승하차 데이터가 없습니다.</p>`;
            return;
        }

        // 갱신 시점 표시 (YYYY. MM. DD. HH:mm:ss 형식)
        const date2 = new Date(updatedAt);
        const year2 = date2.getFullYear();
        const month2 = String(date2.getMonth() + 1).padStart(2, '0');
        const day2 = String(date2.getDate()).padStart(2, '0');
        const hours2 = String(date2.getHours()).padStart(2, '0');
        const minutes2 = String(date2.getMinutes()).padStart(2, '0');
        const seconds2 = String(date2.getSeconds()).padStart(2, '0');
        const updateTime = `${year2}. ${month2}. ${day2}. ${hours2}:${minutes2}:${seconds2}`;
        updatedDiv.innerHTML = `<strong>갱신 시점:</strong> ${updateTime}`;

        // 테이블 생성
        let tableHTML = `
            <table class="passenger-table">
                <thead>
                    <tr>
                        <th>시간</th>
                        <th>승차인원</th>
                        <th>하차인원</th>
                        <th>승하차 집중도</th>
                    </tr>
                </thead>
                <tbody>`;

        data.forEach(item => {
            const getOn = item.get_on_personnel;
            const getOff = item.get_off_personnel;

            // 승하차 집중도 계산
            let concentration = '';
            let concentrationClass = '';
            if (getOn > getOff) {
                concentration = '승차집중';
                concentrationClass = 'concentration-on';
            } else if (getOn < getOff) {
                concentration = '하차집중';
                concentrationClass = 'concentration-off';
            } else {
                concentration = '동일';
                concentrationClass = 'concentration-equal';
            }

            // 시간 포맷팅 (HH:00 형식)
            const hour = item.hour.toString().padStart(2, '0');
            const timeStr = `${hour}:00`;

            tableHTML += `
                <tr>
                    <td><strong>${timeStr}</strong></td>
                    <td class="passenger-count">${getOn.toLocaleString()}   명</td>
                    <td class="passenger-count">${getOff.toLocaleString()}   명</td>
                    <td><span class="concentration-badge ${concentrationClass}">${concentration}</span></td>
                </tr>`;
        });

        tableHTML += `
                </tbody>
            </table>`;

        tableDiv.innerHTML = tableHTML;

    } else {
        statusDiv.innerHTML = '실패';
        statusDiv.className = 'status error';
        tableDiv.innerHTML = `<span class="error">Error: ${result.error || JSON.stringify(result.data)}</span>`;
        updatedDiv.innerHTML = '';
    }
}




// 페이지 로드 시 자동 실행 (설정에 따라) ---------------------------
window.addEventListener('DOMContentLoaded', function() {
    if (CONFIG.AUTO_LOAD_CCTV) {
        console.log('페이지 로드 완료, CCTV 스트림 자동 로드 시작...');
        loadCCTVStreams();
    }
});
