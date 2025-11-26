// -------------------------- config --------------------------

const API_BASE_URL = "http://localhost:58000";
const TARGET_AREA_NAME = "강남역"

  // api 호출 주기 (ms)
const REFRESH_INTERVALS = {
  incidents: 60000,                   // 1분

  population: 60000,                  // 1분
  traffic: 300000,                    // 5분
  subway_arrv: 60000,                 // 1분
  transit_accm: 300000,               // 5분
  culture: 3600000,                   // 1시간
  weather: 600000,                    // 10분

  // livingPop: 60000,                   // 1분
};

  // 각 카드별 마지막 갱신 시간 저장
const lastUpdateTimes = {};

  // 돌발정보 유형코드
const ACC_TYPE_MAP = {
  'A01': '교통사고',
  'A02': '차량고장',
  'A03': '보행사고',
  'A04': '공사',
  'A05': '낙하물',
  'A06': '버스사고',
  'A07': '지하철사고',
  'A08': '화재',
  'A09': '기상/재난',
  'A10': '집회및행사',
  'A11': '기타',
  'A12': '제보',
  'A13': '단순정보'
};

// -------------------------- 갱신 관련 --------------------------

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
  const now = new Date();
  
  Object.keys(REFRESH_INTERVALS).forEach(cardName => {
    const interval = REFRESH_INTERVALS[cardName];
    // 공식: (현재시간 ÷ 주기)의 올림값 * 주기 = 다음 정각 시간
    // 예: 1분 주기일 때, 12:00:40(timestamp) -> 다음 정각은 12:01:00
    const nextTickTime = Math.ceil(now.getTime() / interval) * interval;
    
    const remaining = nextTickTime - now.getTime();
    
    const nextEl = document.getElementById(`${cardName}-next`);
    
    // 남은 시간이 음수거나 너무 길면(오차 보정) 처리
    if (nextEl) {
      if (remaining <= 0) {
        nextEl.textContent = "갱신 중...";
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        nextEl.textContent = `${minutes}분 ${seconds}초 후`;
      }
    }
  });
}

  // 실시간율
function updateSystemHealth() {
  const now = new Date().getTime();
  const serviceKeys = Object.keys(REFRESH_INTERVALS);
  const totalServices = serviceKeys.length;
  
  let totalFreshness = 0;
  
  // 지연된 서비스(데이터가 아예 안 들어오는 경우) 체크용
  let delayedServices = [];

  serviceKeys.forEach(key => {
    const interval = REFRESH_INTERVALS[key];
    const lastUpdate = lastUpdateTimes[key];

    // 1. 데이터가 한 번도 안 왔거나, 2주기 이상 지연되면 0점 처리 (장애 상황)
    if (!lastUpdate || (now - lastUpdate.getTime() > interval * 2)) {
      totalFreshness += 0;
      delayedServices.push(key);
    } else {
      // 2. 정상 상황: "정각 사이클" 내에서의 신선도 계산
      // 예: 1분 주기인데 현재 45초 지남 -> (60-45)/60 = 25% 신선도
      const elapsedInCycle = now % interval; 
      let freshness = (interval - elapsedInCycle) / interval;
      
      // 보정: 막 갱신된 시점(0초~2초)은 100%로 유지해줌
      if (freshness > 0.95) freshness = 1;
      if (freshness < 0) freshness = 0;
      
      totalFreshness += freshness;
    }
  });

  const rate = totalServices === 0 ? 0 : Math.round((totalFreshness / totalServices) * 100);
  renderHealthUI(rate, delayedServices);
}

function renderHealthUI(rate, delayedServices) {
  const box = document.getElementById('system-health-box');
  const valueEl = document.getElementById('system-health-rate');
  
  if (!box || !valueEl) return;

  // 1. 값 업데이트
  valueEl.textContent = `${rate}%`;

  // 2. 색상 상태 변경 (클래스 교체)
  box.classList.remove('status-safe', 'status-warn', 'status-danger');

  if (rate >= 75) {
    box.classList.add('status-safe');
  } else if (rate >= 35) {
    box.classList.add('status-warn');
  } else {
    box.classList.add('status-danger');
  }

  // 3. 툴팁에 지연 서비스 표시
  if (delayedServices && delayedServices.length > 0) {
    box.title = `지연됨: ${delayedServices.join(', ')}`;
  } else {
    box.title = "모든 데이터가 최신입니다.";
  }
}

// ---------------------- 혼잡도 태그 색/스타일 -----------------------

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

// ---------------------- 실시간 인구 현황 ----------------------

async function fetchPopulationData() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/city/population/current?area_name=${TARGET_AREA_NAME}`
    );
    if (!response.ok) throw new Error("Current API Error");
    const data = await response.json();

      // 혼잡도 태그 업데이트
    const congestEl = document.getElementById("population-congest");
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

      // 인구수 업데이트
    document.getElementById("population-min").textContent = data.ppltn_min.toLocaleString("ko-KR");
    document.getElementById("population-max").textContent = data.ppltn_max.toLocaleString("ko-KR");

      // 갱신 시간 업데이트
    updateTimestamps('population');

  } catch (error) {
    console.error("인구 현황 수신 실패:", error);
  }
}

// ---------------------- 예측 데이터 ----------------------

async function fetchForecastData() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/city/population/forecast?area_name=${TARGET_AREA_NAME}`
    );

    const container = document.getElementById("forecast-chart");
    if (!container) {
      console.warn("HTML에 'forecast-chart' ID를 가진 요소가 없습니다.");
      return;
    }

    container.innerHTML = "";

    if (!response.ok) {
      container.innerHTML = "<span class='loading-msg'>예측 데이터 없음</span>";
      return;
    }

    const list = await response.json();

    if (!list || list.length === 0) {
      container.innerHTML = "<span class='loading-msg'>예측 데이터 준비중</span>";
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

// ------------------------ 도로 소통 ------------------------

  // 도로 소통 상태별 스타일
function getTrafficStyle(idx) {
  if (!idx) return { color: "#9ca3af", bg: "#f3f4f6" };

  if (idx.includes("원활")) {
    return { color: "#10b981", bg: "#dcfce7" };
  } else if (idx.includes("서행")) {
    return { color: "#f59e0b", bg: "#fef3c7" };
  } else if (idx.includes("정체")) {
    return { color: "#ef4444", bg: "#fee2e2" };
  }
  return { color: "#6b7280", bg: "#f3f4f6" };
}

async function fetchTrafficData() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/city/traffic/road?area_name=${TARGET_AREA_NAME}`
    );
    if (!response.ok) throw new Error("Traffic API Error");
    const data = await response.json();

    const card = document.getElementById("card-traffic");

      // 현재 단계 업데이트
    const levelEl = card.querySelector('.card-row > div > div:nth-child(2)');
    const trafficIdx = data.road_traffic_idx || '정보없음';
    levelEl.textContent = trafficIdx;

      // 소통 상태에 따른 색상 적용
    const style = getTrafficStyle(trafficIdx);
    levelEl.style.color = style.color;

      // 평균 속도 업데이트
    const speedEl = card.querySelector('.card-row > div > div:nth-child(3) .text-strong');
    if (speedEl) {
      speedEl.textContent = `${data.road_traffic_spd || 0}km/h`;
    }

      // 메시지 업데이트 (있으면)
    if (data.road_msg) {
      const msgEl = card.querySelector('.traffic-bar-wrap > div:last-child .text-strong');
      if (msgEl) msgEl.textContent = data.road_msg;
    }

    updateTimestamps('traffic');
  } catch (error) {
    console.error("도로 소통 수신 실패:", error);
  }
}

// ---------------------- 지하철 실시간 도착 ----------------------

  // 호선별 색상 (서울 지하철 공식 색상)
function getLineColor(lineNum) {
  const colors = {
    '1': '#0052A4',      // 1호선 - 남색
    '2': '#00A84D',      // 2호선 - 녹색
    '3': '#EF7C1C',      // 3호선 - 주황
    '4': '#00A5DE',      // 4호선 - 하늘색
    '5': '#996CAC',      // 5호선 - 보라
    '6': '#CD7C2F',      // 6호선 - 갈색
    '7': '#747F00',      // 7호선 - 올리브
    '8': '#E6186C',      // 8호선 - 분홍
    '9': '#BDB092',      // 9호선 - 황금색
    '신분당선': '#A71E31' // 신분당 - 빨강
  };
  return colors[lineNum] || '#6b7280';
}

  // 호선 표시 텍스트 (신분당선은 '신분당'으로 짧게)
function getLineLabel(lineNum) {
  if (lineNum === '신분당선') return '신분당';
  return lineNum;
}

async function fetchSubwayData() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/subway/arrival/board?area_name=${TARGET_AREA_NAME}`
    );
    if (!response.ok) throw new Error("Subway API Error");
    const result = await response.json();

    const container = document.getElementById("subway-arrival-list");

    if (!result.data || result.data.length === 0) {
      container.innerHTML = '<div class="loading-msg">도착 정보 없음</div>';
      return;
    }

      // 노선별로 그룹화 (최대 4개만 표시)
    const grouped = {};
    result.data.forEach(item => {
      const key = `${item.line_num}-${item.train_line_nm}`;
      if (!grouped[key]) {
        grouped[key] = item;
      }
    });

    const arrivals = Object.values(grouped).slice(0, 4);

    container.innerHTML = arrivals.map(item => {
      const lineColor = getLineColor(item.line_num);
      const lineLabel = getLineLabel(item.line_num);
      const direction = item.train_line_nm.split(' - ')[0] || item.train_line_nm;
      return `
        <div class="subway-arrival-item">
          <div class="subway-line-badge" style="background:${lineColor}">${lineLabel}</div>
          <div class="subway-info">
            <div class="subway-direction">${direction}</div>
            <div class="subway-msg">${item.arrival_msg_1 || '정보없음'}</div>
          </div>
        </div>
      `;
    }).join('');

    updateTimestamps('subway_arrv');
  } catch (error) {
    console.error("지하철 도착정보 수신 실패:", error);
  }
}

// ---------------------- 실시간 돌발정보 ----------------------

async function fetchIncidentsData() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/incident/active`
    );
    if (!response.ok) throw new Error("Incident API Error");
    const incidents = await response.json();

    const container = document.querySelector("#card-incidents .card-body");
    const countTag = document.querySelector("#card-incidents .tag");

      // 건수 업데이트 및 태그 스타일 적용
    countTag.textContent = `${incidents.length}건`;
    if (incidents.length === 0) {
      countTag.className = "tag";
      countTag.style.backgroundColor = "#dcfce7";
      countTag.style.color = "#10b981";
    } else if (incidents.length <= 2) {
      countTag.className = "tag";
      countTag.style.backgroundColor = "";
      countTag.style.color = "";
    } else {
      countTag.className = "tag tag-amber";
      countTag.style.backgroundColor = "";
      countTag.style.color = "";
    }

      // 돌발정보 목록 렌더링
    if (incidents.length === 0) {
      container.innerHTML = '<div class="loading-msg">현재 돌발정보 없음</div>';
    } else {
      container.innerHTML = incidents.map(item => {
        // [수정] 코드(A01 등)를 이용해 아이콘과 한글명 가져오기
        const typeIcon = getIncidentIcon(item.acc_type);
        const typeName = ACC_TYPE_MAP[item.acc_type] || item.acc_type || '기타';
        
        const timeAgo = getTimeAgo(item.occr_date, item.occr_time);
        
        return `
          <div class="incident-item">
            <div class="incident-header">
              <div class="incident-type">${typeIcon} ${typeName}</div>
              <div class="incident-time">${timeAgo}</div>
            </div>
            <div class="incident-content">
              <div class="incident-detail">${item.acc_info || '상세정보 없음'}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    updateTimestamps('incidents');
  } catch (error) {
    console.error("돌발정보 수신 실패:", error);
  }
}

  // 발생 시간 파싱 (Date 객체 반환)
function parseIncidentTime(date, time) {
  if (!date || !time) return null;
  try {
    const timeStr = time.padStart(6, '0'); // "1400" -> "140000" 처리
    return new Date(
      `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${timeStr.slice(0,2)}:${timeStr.slice(2,4)}:${timeStr.slice(4,6)}`
    ).getTime();
  } catch {
    return null;
  }
}

function getIncidentIcon(code) {
  const icons = {
    'A01': '🚗', // 교통사고
    'A02': '🔧', // 차량고장
    'A03': '🚶', // 보행사고
    'A04': '🚧', // 공사
    'A05': '📦', // 낙하물
    'A06': '🚌', // 버스사고
    'A07': '🚇', // 지하철사고
    'A08': '🔥', // 화재
    'A09': '⛈️', // 기상/재난
    'A10': '📢', // 집회및행사
    'A11': '⚠️', // 기타
    'A12': '📞', // 제보
    'A13': 'ℹ️'  // 단순정보
  };
  return icons[code] || '⚠️';
}

function getTimeAgo(date, time) {
  if (!date || !time) return '';
  const occur = new Date(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${time.slice(0,2)}:${time.slice(2,4)}`);
  const diff = Math.floor((Date.now() - occur) / 60000);
  if (diff < 60) return `${diff}분 전`;
  return `${Math.floor(diff/60)}시간 전`;
}

// ---------------------------- 문화행사 ----------------------------

function updateCultureData() {
  updateTimestamps('culture');
}

// ---------------------------- 날씨 API ----------------------------

  // 날씨 아이콘 매핑
function getWeatherIcon(precptType, temp) {
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour >= 18;

  if (precptType === '비' || precptType === '소나기') return '🌧️';
  if (precptType === '눈') return '🌨️';
  if (precptType === '비/눈') return '🌨️';

  return isNight ? '🌙' : '☀️';
}

  // 대기질 등급 스타일
function getAirQualityStyle(airIdx) {
  if (!airIdx) return { text: '-', color: '#9ca3af' };

  if (airIdx.includes('좋음')) return { text: '좋음', color: '#10b981' };
  if (airIdx.includes('보통')) return { text: '보통', color: '#3b82f6' };
  if (airIdx.includes('나쁨') && !airIdx.includes('매우')) return { text: '나쁨', color: '#f59e0b' };
  if (airIdx.includes('매우')) return { text: '매우나쁨', color: '#ef4444' };

  return { text: airIdx, color: '#6b7280' };
}

async function fetchWeatherData() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/city/weather/current?area_name=${TARGET_AREA_NAME}`
    );
    if (!response.ok) throw new Error("Weather API Error");
    const data = await response.json();

      // 날씨 아이콘 업데이트
    const iconEl = document.querySelector('.weather-icon');
    if (iconEl) {
      iconEl.textContent = getWeatherIcon(data.precpt_type, data.temp);
    }

      // 기온 업데이트
    const tempEl = document.querySelector('.weather-temp');
    if (tempEl && data.temp !== null) {
      tempEl.textContent = `${data.temp.toFixed(1)}℃`;
    }

      // 대기질 업데이트 (미세먼지)
    const airValues = document.querySelectorAll('.air-value');
    if (airValues.length >= 2) {
      const airStyle = getAirQualityStyle(data.air_idx);
      airValues[0].textContent = airStyle.text;
      airValues[0].style.color = airStyle.color;

        // 초미세먼지도 동일하게 (air_idx_main이 있으면 사용)
      const airMainStyle = getAirQualityStyle(data.air_idx_main || data.air_idx);
      airValues[1].textContent = airMainStyle.text;
      airValues[1].style.color = airMainStyle.color;
    }

    updateTimestamps('weather');
  } catch (error) {
    console.error("날씨 데이터 수신 실패:", error);
  }
}

// -------------------- 대중교통 승하차 인원 --------------------

async function fetchTransitPassengerData() {
  const container = document.getElementById("transit_accm-passenger-chart");
  if (!container) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/city/transit/passenger?area_name=${TARGET_AREA_NAME}`
    );

    if (!response.ok) {
      container.innerHTML = '<div class="loading-msg">데이터 준비중</div>';
      return;
    }

    const data = await response.json();

      // 데이터 검증
    if (!data.subway && !data.bus) {
      container.innerHTML = '<div class="loading-msg">데이터 없음</div>';
      return;
    }

      // 지하철/버스 승하차 데이터 (누적)
    const subwayOn = data.subway ? Math.round((data.subway.get_on_min + data.subway.get_on_max) / 2) : 0;
    const subwayOff = data.subway ? Math.round((data.subway.get_off_min + data.subway.get_off_max) / 2) : 0;
    const busOn = data.bus ? Math.round((data.bus.get_on_min + data.bus.get_on_max) / 2) : 0;
    const busOff = data.bus ? Math.round((data.bus.get_off_min + data.bus.get_off_max) / 2) : 0;

    container.innerHTML = `
      <div class="transit-row">
        <div class="transit-type">
          <span class="transit-icon subway">🚇</span>
          <span>지하철</span>
        </div>
        <div class="transit-stats">
          <span class="stat-up">${subwayOn.toLocaleString()}</span>
          <span class="stat-down">${subwayOff.toLocaleString()}</span>
        </div>
      </div>
      <div class="transit-row">
        <div class="transit-type">
          <span class="transit-icon bus">🚌</span>
          <span>버스</span>
        </div>
        <div class="transit-stats">
          <span class="stat-up">${busOn.toLocaleString()}</span>
          <span class="stat-down">${busOff.toLocaleString()}</span>
        </div>
      </div>
    `;

    updateTimestamps('transit_accm');
  } catch (error) {
    console.error("대중교통 승하차 데이터 수신 실패:", error);
    container.innerHTML = '<div class="loading-msg">연결 실패</div>';
  }
}

// -------------------- Google Map + CCTV 마커 --------------------

const CCTV_LOCATIONS = [
  { id: 1, name: "강남역 10번 출구", lat: 37.498006, lng: 127.02762 },
  { id: 2, name: "강남역 11번 출구", lat: 37.49772, lng: 127.02845 },
  { id: 3, name: "강남대로 횡단보도 앞", lat: 37.4985, lng: 127.0268 },
];

let map;
let is3DMode = false;

function initMap() {
  const gangnam = { lat: 37.4979, lng: 127.0276 };

  map = new google.maps.Map(document.getElementById("google-map"), {
    center: gangnam,
    zoom: 17,
    disableDefaultUI: true,
    mapTypeId: "roadmap",
    tilt: 0,
    heading: 0,
  });

  addCctvMarkers();
  setup3DToggle();
}

  // 3D 보기 전환 설정
function setup3DToggle() {
  const btn = document.querySelector(".dt-btn-overlay");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (is3DMode) {
        // 2D 모드로 전환 (일반 지도)
      map.setMapTypeId("roadmap");
      map.setTilt(0);
      map.setHeading(0);
      map.setZoom(17);
      btn.textContent = "3D 보기 전환";
      btn.classList.remove("active");
      is3DMode = false;
    } else {
        // 3D 모드로 전환 (위성 + 기울기)
      map.setMapTypeId("hybrid");  // 위성 + 도로명
      map.setTilt(45);
      map.setHeading(90);
      map.setZoom(18);
      btn.textContent = "2D 보기 전환";
      btn.classList.add("active");
      is3DMode = true;
    }
  });
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

// !!! CCTV 구버전 !!!
// // CCTV 모달 열기
// window.openCctv = function (cctvId) {
//   console.log("CCTV 열기:", cctvId);
  
//   const modal = document.getElementById('cctv-modal');
//   const title = document.getElementById('modal-cctv-title');
  
//   // 제목 설정 (CCTV ID에 따라 이름 매핑)
//   // CCTV_LOCATIONS 배열을 활용해 이름을 찾습니다.
//   const targetCCTV = CCTV_LOCATIONS.find(c => c.id == cctvId);
//   title.textContent = targetCCTV ? targetCCTV.name : `CCTV #${cctvId}`;

//   // 모달 보여주기 (hidden 클래스 제거)
//   modal.classList.remove('hidden');

//   // TODO: 여기에 실제 비디오 스트리밍 연결 로직 추가
//   // 예: hls.loadSource(streamUrl);
// };

// // CCTV 모달 닫기
// window.closeCctv = function () {
//   const modal = document.getElementById('cctv-modal');
//   modal.classList.add('hidden');
  
//   // 영상 정지 로직이 필요하면 여기에 추가
// };

// // 배경 클릭 시 닫기
// document.getElementById('cctv-modal').addEventListener('click', (e) => {
//     if (e.target === document.getElementById('cctv-modal')) {
//         closeCctv();
//     }
// });

  // HLS 객체 전역 변수
let hls = null;

  // CCTV 미니 플레이어 열기
window.openCctv = async function (cctvId) {
    console.log("CCTV 미니창 열기:", cctvId);

    const playerBox = document.getElementById('cctv-mini-player');
    const title = document.getElementById('player-title');
    const video = document.getElementById('cctv-player');

      // 1. 플레이어 UI 보여주기 (기존 hidden 제거)
    playerBox.classList.remove('hidden');

      // 2. 제목 설정
    const targetCCTV = CCTV_LOCATIONS.find(c => c.id == cctvId);
    title.textContent = targetCCTV ? targetCCTV.name : `CCTV #${cctvId}`;

      // 3. 스트림 URL 연결 (기존 로직 유지)
    try {
        if (hls) {
            hls.destroy();
            hls = null;
        }

        const response = await fetch(
          `${API_BASE_URL}/cctv/streams`
        );
        const result = await response.json();
        const streamData = result.data[cctvId - 1];

        if (!streamData) {
            alert("CCTV 정보를 찾을 수 없습니다.");
            return;
        }

        const streamUrl = streamData.stream_url;

        if (Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function () {
                video.play().catch(e => console.log("자동재생 막힘:", e));
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', function () {
                video.play();
            });
        }

    } catch (error) {
        console.error("CCTV 연결 에러:", error);
    }
};

  // CCTV 닫기
window.closeCctv = function () {
    const playerBox = document.getElementById('cctv-mini-player');
    const video = document.getElementById('cctv-player');

      // UI 숨기기
    playerBox.classList.add('hidden');

      // 영상 정지 및 자원 해제 (데이터 낭비 방지)
    if (video) {
        video.pause();
        video.src = "";
    }
    if (hls) {
        hls.destroy();
        hls = null;
    }
};

// ----------------------- 대시보드 초기화 ------------------------

function initDashboard() {
  fetchPopulationData();
  fetchForecastData();
  fetchTrafficData();
  fetchIncidentsData();
  fetchSubwayData();
  fetchWeatherData();
  fetchTransitPassengerData();
  updateCultureData();
  updateSystemHealth();
}

function setupRefreshIntervals() {
  const now = new Date().getTime();

  // 각 데이터별로 "다음 정각"에 첫 실행을 예약하고, 그 후 setInterval로 반복
  const schedules = [
    { key: 'population', func: () => { fetchPopulationData(); fetchForecastData(); } },
    { key: 'traffic', func: fetchTrafficData },
    { key: 'incidents', func: fetchIncidentsData },
    { key: 'subway_arrv', func: fetchSubwayData },
    { key: 'weather', func: fetchWeatherData },
    { key: 'transit_accm', func: fetchTransitPassengerData },
    { key: 'culture', func: updateCultureData }
  ];

  schedules.forEach(item => {
    const interval = REFRESH_INTERVALS[item.key];
    // 다음 정각까지 남은 시간 계산
    const delay = interval - (now % interval);

    // 1. 첫 번째 실행은 "다음 정각"에 수행 (setTimeout)
    setTimeout(() => {
      item.func(); // 정각 실행
      // 2. 그 이후부터 주기적으로 실행 (setInterval)
      setInterval(item.func, interval);
    }, delay);
  });

  // UI 갱신은 그냥 1초마다 계속 돔 (계산 로직이 절대시간 기준이라 상관없음)
  setInterval(() => {
    updateCountdowns();
    updateSystemHealth();
  }, 1000);
}

  // 실행
initDashboard();
setupRefreshIntervals();