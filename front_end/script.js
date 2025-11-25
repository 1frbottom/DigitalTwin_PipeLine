// ---------------- 갱신 시간 관리 ----------------

// 각 카드별 갱신 간격 (밀리초)
const REFRESH_INTERVALS = {
  population: 300000,     // 5분 - 인구현황
  subway: 10000,          // 10초 - 실시간 지하철 도착현황
  traffic: 300000,        // 5분 - 도로소통
  transport: 300000,      // 5분 - 대중교통 승하차
  weather: 600000,        // 10분 - 기상현황
  incidents: 5000,        // 5초 - 실시간 돌발정보
  culture: 3600000,       // 1시간 - 문화행사
};

// 각 카드별 마지막 갱신 시간 저장
const lastUpdateTimes = {};

// 갱신 시간 표시 업데이트 함수
function updateTimestamps(cardName) {
  const now = new Date();
  lastUpdateTimes[cardName] = now;

  // 최근 갱신 시간 표시
  const lastEl = document.getElementById(`${cardName}-last`);
  if (lastEl) {
    lastEl.textContent = now.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // 다음 갱신 시간 계산 및 표시
  const nextUpdate = new Date(now.getTime() + REFRESH_INTERVALS[cardName]);
  const nextEl = document.getElementById(`${cardName}-next`);
  if (nextEl) {
    nextEl.textContent = nextUpdate.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // 카드에 갱신 애니메이션 추가
  addUpdateAnimation(cardName);
}

// 카드 갱신 애니메이션
function addUpdateAnimation(cardName) {
  const cardElement = document.getElementById(`card-${cardName}`);
  if (cardElement) {
    cardElement.classList.remove('card-update');
    // 리플로우 강제
    void cardElement.offsetWidth;
    cardElement.classList.add('card-update');
    
    // 애니메이션 종료 후 클래스 제거
    setTimeout(() => {
      cardElement.classList.remove('card-update');
    }, 600);
  }
}

// 다음 갱신까지 남은 시간 실시간 업데이트
function updateCountdowns() {
  Object.keys(lastUpdateTimes).forEach(cardName => {
    const lastUpdate = lastUpdateTimes[cardName];
    if (!lastUpdate) return;

    const nextUpdate = new Date(lastUpdate.getTime() + REFRESH_INTERVALS[cardName]);
    const now = new Date();
    const remaining = nextUpdate - now;

    if (remaining <= 0) return;

    const seconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    const nextEl = document.getElementById(`${cardName}-next`);
    if (nextEl && minutes < 5) { // 5분 이내일 때만 카운트다운 표시
      nextEl.textContent = `${minutes}분 ${secs}초 후`;
    }
  });
}

// 1초마다 카운트다운 업데이트
setInterval(updateCountdowns, 1000);

// ---------------- 혼잡도 태그 색/스타일 ----------------

function getColorByLevel(level) {
  if (!level) return { color: "#9ca3af", className: "tag" };

  if (level.includes("여유")) {
    return { color: "#10b981", bg: "#dcfce7", className: "tag" };
  } else if (level.includes("보통")) {
    return { color: "#2f80ed", bg: "#e3f2ff", className: "tag" };
  } else if (level.includes("약간 붐빔")) {
    return { color: "#f59e0b", bg: "#fef3c7", className: "tag tag-amber" };
  } else if (level.includes("붐빔")) {
    return { color: "#ef4444", bg: "#fee2e2", className: "tag tag-danger" };
  } else {
    return { color: "#6b7280", bg: "#f3f4fa", className: "tag" };
  }
}

// ---------------- 실시간 인구 현황 ----------------

async function fetchPopulationData() {
  try {
    const response = await fetch(
      "http://localhost:8000/city/population/current?area_name=강남역"
    );
    if (!response.ok) throw new Error("Current API Error");
    const data = await response.json();

    console.log("인구 데이터 수신:", data);

    // (1) 혼잡도 태그 업데이트
    const congestEl = document.getElementById("pop-congest");
    const styleInfo = getColorByLevel(data.congest_lvl);

    congestEl.textContent = data.congest_lvl;
    congestEl.className = styleInfo.className;

    if (data.congest_lvl.includes("여유") || data.congest_lvl.includes("보통")) {
      congestEl.style.backgroundColor = styleInfo.bg;
      congestEl.style.color = styleInfo.color;
    } else {
      congestEl.style.backgroundColor = "";
      congestEl.style.color = "";
    }

    // (2) 인구수 업데이트
    document.getElementById("pop-min").textContent = data.ppltn_min.toLocaleString("ko-KR");
    document.getElementById("pop-max").textContent = data.ppltn_max.toLocaleString("ko-KR");

    // (3) 갱신 시간 업데이트
    updateTimestamps('population');

  } catch (error) {
    console.error("인구 현황 수신 실패:", error);
  }
}

// ---------------- 예측 데이터 ----------------

async function fetchForecastData() {
  try {
    const response = await fetch(
      "http://localhost:8000/city/population/forecast?area_name=강남역"
    );

    const container = document.getElementById("forecast-chart");
    if (!container) {
      console.warn("HTML에 'forecast-chart' ID를 가진 요소가 없습니다.");
      return;
    }

    container.innerHTML = "";

    if (!response.ok) {
      container.innerHTML =
        "<span style='font-size:10px; color:#9ca3af; width:100%; text-align:center;'>예측 데이터 없음</span>";
      return;
    }

    const list = await response.json();
    console.log("예측 데이터 수신:", list);

    if (!list || list.length === 0) {
      container.innerHTML =
        "<span style='font-size:10px; color:#9ca3af; width:100%; text-align:center;'>예측 데이터 준비중</span>";
      return;
    }

    const next6 = list.slice(0, 6);
    const values = next6.map((d) => d.fcst_max);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;

    next6.forEach((item) => {
      const fTime = new Date(item.fcst_time);
      const hourLabel = fTime.getHours() + "시";
      const styleInfo = getColorByLevel(item.fcst_congest_lvl);

      let heightPercent = 100;
      if (range > 0) {
        const ratio = (item.fcst_max - minVal) / range;
        heightPercent = 20 + ratio * 80;
      }

      const barHtml = `
        <div class="forecast-item">
          <div
            class="bar-graph"
            title="${item.fcst_congest_lvl} (${item.fcst_min.toLocaleString()}~${item.fcst_max.toLocaleString()}명)"
            style="height: ${heightPercent}%; background-color: ${styleInfo.color};"
          ></div>
          <div class="time-label">${hourLabel}</div>
        </div>
      `;
      container.insertAdjacentHTML("beforeend", barHtml);
    });
  } catch (error) {
    console.error("예측 데이터 수신 실패:", error);
  }
}

// ---------------- 지하철 도착 ----------------

async function fetchSubwayData() {
  try {
    const response = await fetch("http://localhost:8000/subway/arrival/area?area_name=강남역");
    if (!response.ok) throw new Error("Subway API Error");

    const data = await response.json();
    console.log("지하철 데이터 수신:", data);

    const subwayBody = document.querySelector('#card-subway .card-body');
    if (!subwayBody) return;

    // 기존 내용 초기화
    subwayBody.innerHTML = '';

    if (!data || data.length === 0) {
      subwayBody.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-sub); font-size: 12px;">
          지하철 도착 정보가 없습니다.
        </div>
      `;
      updateTimestamps('subway');
      return;
    }

    // 노선별로 그룹화
    const lineGroups = {};
    data.forEach(item => {
      const lineName = item.line_num || '알수없음';

      if (!lineGroups[lineName]) {
        lineGroups[lineName] = [];
      }
      lineGroups[lineName].push(item);
    });

    // 각 노선별로 표시
    Object.keys(lineGroups).forEach((lineName) => {
      subwayBody.innerHTML += `<div class="subway-section-title">${lineName}</div>`;

      const arrivals = lineGroups[lineName].slice(0, 2); // 상위 2개만 표시

      arrivals.forEach(arrival => {
        // arrival_msg_1에서 도착 시간 파싱 (예: "1분후", "[2]번째 전역 (양재)")
        const msg = arrival.arrival_msg_1 || '';
        let arrivalTime = 0;
        const timeMatch = msg.match(/(\d+)분/);
        if (timeMatch) {
          arrivalTime = parseInt(timeMatch[1]);
        }

        const timeClass = arrivalTime <= 1 ? 'urgent' :
                         arrivalTime <= 3 ? 'soon' : 'normal';

        const lineClass = lineName.includes('2호선') ? 'subway-line-2' :
                         lineName.includes('신분당선') ? 'subway-line-sinbundang' :
                         'subway-line-2';

        const arrivalHtml = `
          <div class="subway-arrival-row">
            <div class="subway-line-badge ${lineClass}">${lineName.includes('신분당') ? '신분당' : lineName.replace('호선', '')}</div>
            <div class="subway-arrival-info">
              <div class="subway-direction">${arrival.train_line_nm || '정보없음'}</div>
              <div class="subway-detail">${arrival.arrival_msg_1 || '정보없음'}</div>
            </div>
            <div class="subway-arrival-time ${timeClass}">${arrivalTime > 0 ? arrivalTime + '분' : '곧 도착'}</div>
          </div>
        `;

        subwayBody.innerHTML += arrivalHtml;
      });
    });

    updateTimestamps('subway');

  } catch (error) {
    console.error("지하철 도착 정보 수신 실패:", error);
    const subwayBody = document.querySelector('#card-subway .card-body');
    if (subwayBody) {
      subwayBody.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #ef4444; font-size: 12px;">
          지하철 정보를 불러올 수 없습니다.
        </div>
      `;
    }
  }
}

function updateSubwayData() {
  fetchSubwayData();
}

// ---------------- 도로 소통 ----------------

async function fetchTrafficData() {
  try {
    const response = await fetch("http://localhost:8000/city/traffic/road?area_name=강남역");
    if (!response.ok) {
      console.log("도로 소통 데이터 없음");
      updateTimestamps('traffic');
      return;
    }

    const data = await response.json();
    console.log("도로 소통 데이터 수신:", data);

    updateTimestamps('traffic');

  } catch (error) {
    console.error("도로 소통 정보 수신 실패:", error);
  }
}

function updateTrafficData() {
  fetchTrafficData();
}

// ---------------- 대중교통 ----------------

async function fetchTransportData() {
  try {
    const response = await fetch("http://localhost:8000/city/transit/passenger?area_name=강남역");
    if (!response.ok) {
      console.log("대중교통 데이터 없음");
      updateTimestamps('transport');
      return;
    }

    const data = await response.json();
    console.log("대중교통 승하차 데이터 수신:", data);

    updateTimestamps('transport');

  } catch (error) {
    console.error("대중교통 정보 수신 실패:", error);
  }
}

function updateTransportData() {
  fetchTransportData();
}

// ---------------- 실시간 돌발정보 ----------------

async function fetchIncidentsData() {
  try {
    const response = await fetch("http://localhost:8000/incident/active");
    if (!response.ok) throw new Error("Incident API Error");

    const incidents = await response.json();

    // 돌발정보 카드 업데이트
    const incidentsContainer = document.querySelector('#card-incidents .card-body');
    if (!incidentsContainer) return;

    // 기존 내용 초기화
    incidentsContainer.innerHTML = '';

    if (incidents.length === 0) {
      incidentsContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-sub); font-size: 12px;">
          현재 진행 중인 돌발정보가 없습니다.
        </div>
      `;
    } else {
      // 최대 5개까지만 표시
      const displayIncidents = incidents.slice(0, 5);

      displayIncidents.forEach(incident => {
        const incidentTime = getRelativeTime(incident.occr_date, incident.occr_time);
        const incidentType = getIncidentType(incident.acc_type, incident.acc_dtype);
        const incidentIcon = getIncidentIcon(incident.acc_type);

        const incidentHtml = `
          <div class="incident-item">
            <div class="incident-header">
              <div class="incident-type">${incidentIcon} ${incidentType}</div>
              <div class="incident-time">${incidentTime}</div>
            </div>
            <div class="incident-content">
              <div class="incident-location">${incident.link_id || '위치 정보 없음'}</div>
              <div class="incident-detail">${incident.acc_info || '상세 정보 없음'}</div>
            </div>
          </div>
        `;

        incidentsContainer.insertAdjacentHTML('beforeend', incidentHtml);
      });
    }

    // 돌발정보 건수 업데이트
    const incidentCountTag = document.querySelector('#card-incidents .tag-amber');
    if (incidentCountTag) {
      incidentCountTag.textContent = `${incidents.length}건`;
    }

    // 갱신 시간 업데이트
    updateTimestamps('incidents');

  } catch (error) {
    console.error("돌발정보 수신 실패:", error);

    // 에러 시 기본 메시지 표시
    const incidentsContainer = document.querySelector('#card-incidents .card-body');
    if (incidentsContainer) {
      incidentsContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #ef4444; font-size: 12px;">
          돌발정보를 불러올 수 없습니다.
        </div>
      `;
    }
  }
}

// 돌발정보 타입에 따른 아이콘 반환
function getIncidentIcon(accType) {
  if (!accType) return '⚠️';

  if (accType.includes('사고')) return '🚗';
  if (accType.includes('공사')) return '🚧';
  if (accType.includes('행사')) return '🎪';
  if (accType.includes('통제')) return '⛔';

  return '⚠️';
}

// 돌발정보 타입 텍스트 반환
function getIncidentType(accType, accDtype) {
  if (accDtype) return accDtype;
  if (accType) return accType;
  return '기타';
}

// 상대 시간 계산 (예: "15분 전")
function getRelativeTime(date, time) {
  if (!date || !time) return '-';

  try {
    // YYYYMMDD HHmm 형식 파싱
    const year = date.substring(0, 4);
    const month = date.substring(4, 6);
    const day = date.substring(6, 8);
    const hour = time.substring(0, 2);
    const minute = time.substring(2, 4);

    const incidentDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
    const now = new Date();
    const diffMs = now - incidentDate;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}일 전`;

  } catch (error) {
    console.error('시간 파싱 오류:', error);
    return '-';
  }
}

function updateIncidentsData() {
  fetchIncidentsData();
}

// ---------------- 안전지수 ----------------

function updateSafetyData() {
  updateTimestamps('safety');
}

// ---------------- 예측 ----------------

function updatePredictionData() {
  updateTimestamps('prediction');
}

// ---------------- 기상현황 ----------------

async function fetchWeatherData() {
  try {
    const response = await fetch("http://localhost:8000/city/weather/current?area_name=강남역");
    if (!response.ok) {
      console.log("기상현황 데이터 없음");
      updateTimestamps('weather');
      return;
    }

    const data = await response.json();
    console.log("기상현황 데이터 수신:", data);

    // 헤더의 날씨 정보 업데이트
    const weatherTemp = document.querySelector('.weather-temp');
    const weatherIcon = document.querySelector('.weather-icon');

    if (weatherTemp && data.temp !== undefined) {
      weatherTemp.textContent = `${data.temp}℃`;
    }

    // 날씨 아이콘 업데이트 (간단한 매핑)
    if (weatherIcon && data.weather_desc) {
      const iconMap = {
        '맑음': '☀️',
        '구름많음': '⛅',
        '흐림': '☁️',
        '비': '🌧️',
        '눈': '🌨️',
        '소나기': '⛈️'
      };
      weatherIcon.textContent = iconMap[data.weather_desc] || '🌤️';
    }

    // 미세먼지/초미세먼지 정보 업데이트 (데이터가 있다면)
    const airLabels = document.querySelectorAll('.air-value');
    if (airLabels.length >= 2) {
      if (data.pm10_status) airLabels[0].textContent = data.pm10_status;
      if (data.pm25_status) airLabels[1].textContent = data.pm25_status;
    }

    updateTimestamps('weather');

  } catch (error) {
    console.error("기상현황 수신 실패:", error);
  }
}

function updateWeatherData() {
  fetchWeatherData();
}

// ---------------- 문화행사 ----------------

function updateCultureData() {
  updateTimestamps('culture');
}

// ---------------- 대시보드 초기화 ----------------

function initDashboard() {
  // 인구 데이터
  fetchPopulationData();
  fetchForecastData();

  // 기타 데이터
  updateSubwayData();
  updateTrafficData();
  updateTransportData();
  updateWeatherData();
  updateIncidentsData();
  updateCultureData();
}

// 각 데이터별 갱신 인터벌 설정
function setupRefreshIntervals() {
  // 인구현황 - 5분마다
  setInterval(() => {
    fetchPopulationData();
    fetchForecastData();
  }, REFRESH_INTERVALS.population);

  // 지하철 도착 - 10초마다
  setInterval(updateSubwayData, REFRESH_INTERVALS.subway);

  // 도로소통 - 5분마다
  setInterval(updateTrafficData, REFRESH_INTERVALS.traffic);

  // 대중교통 승하차 - 5분마다
  setInterval(updateTransportData, REFRESH_INTERVALS.transport);

  // 기상현황 - 10분마다
  setInterval(updateWeatherData, REFRESH_INTERVALS.weather);

  // 실시간 돌발정보 - 5초마다
  setInterval(updateIncidentsData, REFRESH_INTERVALS.incidents);

  // 문화행사 - 1시간마다
  setInterval(updateCultureData, REFRESH_INTERVALS.culture);
}

// 초기화 실행
initDashboard();
setupRefreshIntervals();

// ---------------- Google Map + CCTV 마커 ----------------

const CCTV_LOCATIONS = [
  { id: 1, name: "강남역 10번 출구", lat: 37.498006, lng: 127.02762 },
  { id: 2, name: "강남역 11번 출구", lat: 37.49772, lng: 127.02845 },
  { id: 3, name: "강남대로 횡단보도 앞", lat: 37.4985, lng: 127.0268 },
];

let map;

function initMap() {
  const gangnam = { lat: 37.4979, lng: 127.0276 };

  map = new google.maps.Map(document.getElementById("google-map"), {
    center: gangnam,
    zoom: 16,
    disableDefaultUI: true,
  });

  addCctvMarkers();
}

function addCctvMarkers() {
  const infoWindow = new google.maps.InfoWindow();

  CCTV_LOCATIONS.forEach((cctv) => {
    const marker = new google.maps.Marker({
      position: { lat: cctv.lat, lng: cctv.lng },
      map,
      title: cctv.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#e0f2fe",
        fillOpacity: 1,
        strokeColor: "#2563eb",
        strokeWeight: 2,
      },
      label: {
        text: "📹",
        fontSize: "14px",
      },
    });

    marker.addListener("click", () => {
      const html = `
        <div style="min-width: 160px;">
          <div style="font-weight:600; margin-bottom:4px;">${cctv.name}</div>
          <button 
            style="
              padding:4px 8px;
              font-size:11px;
              border-radius:999px;
              border:1px solid #3b82f6;
              background:#eff6ff;
              cursor:pointer;
            "
            onclick="openCctv('${cctv.id}')"
          >
            CCTV 보기
          </button>
        </div>
      `;
      infoWindow.setContent(html);
      infoWindow.open(map, marker);
    });
  });
}

window.openCctv = function (cctvId) {
  console.log("CCTV 클릭:", cctvId);
};

// ---------------- 패널 토글 시스템 ----------------

function initPanelToggle() {
  const chips = document.querySelectorAll('.chip');
  const panels = document.querySelectorAll('.overlay-panel');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const targetPanelId = chip.getAttribute('data-panel');

      // 모든 칩에서 is-active 제거
      chips.forEach(c => c.classList.remove('is-active'));

      // 클릭된 칩에 is-active 추가
      chip.classList.add('is-active');

      // 모든 패널 숨기기
      panels.forEach(panel => {
        panel.classList.remove('is-active');
      });

      // 선택된 패널만 표시
      const targetPanel = document.getElementById(targetPanelId);
      if (targetPanel) {
        // 약간의 딜레이 후 애니메이션 적용
        setTimeout(() => {
          targetPanel.classList.add('is-active');
        }, 50);
      }
    });
  });
}

// 패널 토글 초기화 (DOM 로드 후)
document.addEventListener('DOMContentLoaded', () => {
  initPanelToggle();
});