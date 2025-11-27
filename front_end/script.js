// -------------------------- config --------------------------
const ENV = window.ENV || {};

const API_BASE_URL = ENV.API_BASE_URL
const TARGET_AREA_NAME = "강남역"

  // .html
const MAP_API_KEY = ENV.GOOGLE_MAPS_API_KEY;
if (!MAP_API_KEY) {
  console.error("API Key가 설정되지 않았습니다. .env 파일을 확인하세요.");
} else {
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${MAP_API_KEY}&callback=initMap`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

  // 돌발정보 코드 매핑
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

// 돌발정보 카테고리별 색상 매핑
const ACC_COLOR_MAP = {
  'A01': '#F55', // 교통사고 - Red
  'A02': '#FF8C42', // 차량고장 - Orange
  'A03': '#FF6B6B', // 보행사고 - Light Red
  'A04': '#F9B233', // 공사 - Yellow
  'A05': '#9B59B6', // 낙하물 - Purple
  'A06': '#E74C3C', // 버스사고 - Red variant
  'A07': '#C0392B', // 지하철사고 - Dark Red
  'A08': '#DC143C', // 화재 - Crimson
  'A09': '#34495E', // 기상/재난 - Dark Gray
  'A10': '#3498DB', // 집회및행사 - Blue
  'A11': '#95A5A6', // 기타 - Gray
  'A12': '#16A085', // 제보 - Teal
  'A13': '#7F8C8D' // 단순정보 - Light Gray
};

// -------------------------- 갱신 --------------------------

  // api 호출 주기 (ms)
const REFRESH_INTERVALS = {

  // 실시간 돌발정보
  incidents: 60000,       // 1분

  // 인구현황
  population: 60000,      // 1분

  // 도로소통
  traffic: 300000,        // 5분

  // 실시간 지하철 도착현황
  subway: 60000,          // 1분

  // 대중교통 승하차
  transport: 300000,      // 5분

  // 기상현황
  weather: 600000,        // 10분

  //문화행사
  culture: 3600000,       // 1시간
};

  // 각 카드별 마지막 갱신 시간 저장
const lastUpdateTimes = {};

  // 이전 인구 데이터 저장 (변동률 계산용)
let previousPopulationData = null;

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
  } else {
    console.warn(`갱신 시간 요소를 찾을 수 없음: ${cardName}-last`);
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
  } else {
    console.warn(`다음 갱신 요소를 찾을 수 없음: ${cardName}-next`);
  }

    // 카드에 갱신 애니메이션 추가
  addUpdateAnimation(cardName);
}

  // 카드 갱신 애니메이션
function addUpdateAnimation(cardName) {
  const cardElement = document.getElementById(`card-${cardName}`);
  if (cardElement) {
    // 해당 카드의 패널이 열려있는지 확인
    const panelId = `panel-${cardName}`;
    const panel = document.getElementById(panelId);
    const isPanelOpen = panel && panel.classList.contains('is-active');

    if (isPanelOpen) {
      // 패널이 열려있으면 카드에 애니메이션
      cardElement.classList.remove('card-update');
      void cardElement.offsetWidth;
      cardElement.classList.add('card-update');

      setTimeout(() => {
        cardElement.classList.remove('card-update');
      }, 600);
    } else {
      // 패널이 닫혀있으면 해당 칩에 애니메이션
      const chipElement = document.querySelector(`[data-panel="${panelId}"]`);
      if (chipElement) {
        chipElement.classList.remove('chip-update');
        void chipElement.offsetWidth;
        chipElement.classList.add('chip-update');

        setTimeout(() => {
          chipElement.classList.remove('chip-update');
        }, 600);
      }
    }
  }
}

// 다음 갱신까지 남은 시간 실시간 업데이트
function updateCountdowns() {
  const now = new Date().getTime(); // timestamp로 변환
  
  Object.keys(REFRESH_INTERVALS).forEach(cardName => {
    const interval = REFRESH_INTERVALS[cardName];
    // 공식: (현재시간 ÷ 주기)의 올림값 * 주기 = 다음 정각 시간
    const nextTickTime = Math.ceil(now / interval) * interval;
    
    const remaining = nextTickTime - now;
    const nextEl = document.getElementById(`${cardName}-next`);
    
    if (nextEl) {
      if (remaining <= 0) {
        nextEl.textContent = "갱신 중...";
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        
        // 1분 이상 남았을 때와 미만일 때 구분
        if (minutes > 0) {
           nextEl.textContent = `${minutes}분 ${seconds}초 후`;
        } else {
           nextEl.textContent = `${seconds}초 후`;
        }
      }
    }
  });
}

// ---------------------- 실시간율 ----------------------

function updateSystemHealth() {
  const now = new Date().getTime();
  const serviceKeys = Object.keys(REFRESH_INTERVALS);
  const totalServices = serviceKeys.length;
  
  let totalFreshness = 0;
  let delayedServices = [];

  serviceKeys.forEach(key => {
    const interval = REFRESH_INTERVALS[key];
    const lastUpdate = lastUpdateTimes[key];

    // 데이터가 없거나 2주기 이상 지연 시 0점
    if (!lastUpdate || (now - lastUpdate.getTime() > interval * 2)) {
      totalFreshness += 0;
      delayedServices.push(key);
    } else {
      // 정각 사이클 내 신선도 계산
      const elapsedInCycle = now % interval; 
      let freshness = (interval - elapsedInCycle) / interval;
      
      // 보정: 갱신 직후는 100% 유지
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

  // 값 업데이트
  valueEl.textContent = `${rate}%`;

  // 상태 색상 변경
  box.classList.remove('status-safe', 'status-warn', 'status-danger');

  if (rate >= 75) {
    box.classList.add('status-safe');
  } else if (rate >= 35) {
    box.classList.add('status-warn');
  } else {
    box.classList.add('status-danger');
  }

  // 툴팁 설정
  if (delayedServices.length > 0) {
    box.title = `지연됨: ${delayedServices.join(', ')}`;
  } else {
    box.title = "모든 데이터가 최신입니다.";
  }
}

// ------------------  혼잡도 태그 색/스타일 -------------------

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

    // (3) 변동률 계산 및 업데이트
    const popChangeEl = document.getElementById("pop-change");
    if (popChangeEl && previousPopulationData) {
      const currentAvg = (data.ppltn_min + data.ppltn_max) / 2;
      const previousAvg = (previousPopulationData.ppltn_min + previousPopulationData.ppltn_max) / 2;
      const changePercent = ((currentAvg - previousAvg) / previousAvg * 100).toFixed(1);

      if (changePercent > 0) {
        popChangeEl.textContent = `▲ ${changePercent}%`;
        popChangeEl.style.color = "#dc2626";
      } else if (changePercent < 0) {
        popChangeEl.textContent = `▼ ${Math.abs(changePercent)}%`;
        popChangeEl.style.color = "#2563eb";
      } else {
        popChangeEl.textContent = ""; // 0%일 때 빈칸
      }

    } else if (popChangeEl) {
      popChangeEl.textContent = ""; 
    }

    // 현재 데이터를 이전 데이터로 저장
    previousPopulationData = {
      ppltn_min: data.ppltn_min,
      ppltn_max: data.ppltn_max
    };

    // (4) 갱신 시간 업데이트
    updateTimestamps('population');

  } catch (error) {
    console.error("인구 현황 수신 실패:", error);
  }
}

// ---------------------- 인구현황 예측 ----------------------

async function fetchForecastData() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/city/population/forecast?area_name=${TARGET_AREA_NAME}`
    );

    const container = document.getElementById("forecast-chart");
    if (!container) return;

    container.innerHTML = "";

    if (!response.ok) {
      container.innerHTML = "<span style='font-size:10px; color:#9ca3af; width:100%; text-align:center;'>예측 데이터 없음</span>";
      return;
    }

    const list = await response.json();
    if (!list || list.length === 0) {
      container.innerHTML = "<span style='font-size:10px; color:#9ca3af; width:100%; text-align:center;'>예측 데이터 준비중</span>";
      return;
    }

    const next6 = list.slice(0, 6);
    
    // 1. 데이터 최댓값 구하기
    const values = next6.map(d => d.fcst_max);
    const maxVal = Math.max(...values);

    // [핵심 로직 변경]
    // 10,000 단위 스텝 사용
    const STEP = 10000; 

    // yMax: 데이터 최댓값을 포함하는 10,000 단위 올림값 (예: 92,000 -> 100,000)
    let yMax = Math.ceil(maxVal / STEP) * STEP;
    if (yMax === 0) yMax = STEP;

    // yMin: yMax 기준으로 무조건 4칸(40,000) 아래로 설정
    // 예: yMax가 10만이면 yMin은 6만 (눈금: 6, 7, 8, 9, 10만 -> 5개)
    // 예: yMax가 5만이면 yMin은 1만 (눈금: 1, 2, 3, 4, 5만)
    let yMin = yMax - (4 * STEP);

    // 음수가 나오면 0으로 고정
    if (yMin < 0) yMin = 0;

    const range = yMax - yMin;

    // 2. 배경 눈금선 그리기 (yMin ~ yMax)
    for (let i = yMin; i <= yMax; i += STEP) {

      const posPercent = ((i - yMin) / range) * 100;

      const lineHtml = `
        <div class="grid-line" style="bottom: ${posPercent}%;">
          <span>${(i / 10000).toFixed(0)}만명</span>
        </div>
      `;
      container.insertAdjacentHTML("beforeend", lineHtml);
    }

    // 3. 그래프 바 그리기
    next6.forEach((item) => {
      const fTime = new Date(item.fcst_time);
      const hourLabel = fTime.getHours() + "시";
      const styleInfo = getColorByLevel(item.fcst_congest_lvl);

      // 높이 계산
      let heightPercent = ((item.fcst_max - yMin) / range) * 100;
      
      // 최소 높이 1% 안전장치
      if (heightPercent < 1) heightPercent = 1;
      if (heightPercent > 100) heightPercent = 100;

      const barHtml = `
        <div class="forecast-item">
          <div
            class="bar-graph"
            title="${item.fcst_congest_lvl} (최대 ${item.fcst_max.toLocaleString()}명)"
            style="height: ${heightPercent.toFixed(1)}%; background-color: ${styleInfo.color};"
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
    const response = await fetch(
      `${API_BASE_URL}/subway/arrival/area?area_name=${TARGET_AREA_NAME}`
    );
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

        const cleaned = lineName.replace(/[^0-9가-힣]/g, '');  

        let lineClass;

        if (cleaned.includes('2호선') || cleaned.includes('2')) {
          lineClass = 'subway-line-2';
        } else if (cleaned.includes('신분당선') || cleaned.includes('신분당')) {
          lineClass = 'subway-line-sinbundang';
        } else if (cleaned.includes('9호선') || cleaned.includes('9')) {
          lineClass = 'subway-line-9';
        } else {
          lineClass = 'subway-line-1';
        }

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
    // 에러 발생 시에도 갱신 시간 업데이트
    updateTimestamps('subway');
  }
}

function updateSubwayData() {
  fetchSubwayData();
}

// ---------------- 도로 소통 ----------------

// 단계에 따라 포인터 위치 업데이트
// 비율: 원활 33.33%, 서행 33.33%, 정체 33.33% (삼등분)
function setTrafficIndicator(stage) {
  const indicator = document.getElementById('traffic-indicator');
  if (!indicator) return;

  // 각 구간의 중앙 위치 계산
  // 원활: 0~33.33% 구간의 중앙 = 16.67%
  // 서행: 33.33~66.67% 구간의 중앙 = 50%
  // 정체: 66.67~100% 구간의 중앙 = 83.33%
  const POS = {
    '원활': 16.67,  // 원활 구간 중앙
    '서행': 50,     // 서행 구간 중앙
    '정체': 83.33   // 정체 구간 중앙
  };

  const leftPercent = POS[stage] ?? 50; // 기본값: 서행
  indicator.style.left = leftPercent + '%';
}

async function fetchTrafficData() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/city/traffic/road?area_name=${TARGET_AREA_NAME}`
    );

    if (!response.ok) {
      console.log("도로 소통 데이터 없음");
      updateTimestamps('traffic');
      return;
    }

    const data = await response.json();
    console.log("도로 소통 데이터 수신:", data);

    // 도로소통 단계 색상 매핑
    const statusColorMap = {
      '원활': { color: '#3CB371', text: '원활' },
      '서행': { color: '#E8A43A', text: '서행' },
      '정체': { color: '#D9534F', text: '정체' }
    };

    const statusInfo = statusColorMap[data.road_traffic_idx] || { color: '#6b7280', text: data.road_traffic_idx || '정보없음' };

    // 현재 단계 텍스트 업데이트
    const statusTextEl = document.getElementById('traffic-status-text');
    if (statusTextEl) {
      statusTextEl.textContent = statusInfo.text;
      statusTextEl.style.color = statusInfo.color;
    }

    // 평균 속도 업데이트
    const speedEl = document.getElementById('traffic-speed');
    if (speedEl) {
      speedEl.textContent = `${data.road_traffic_spd || 0}km/h`;
    }

    // 포인터 위치 갱신
    setTrafficIndicator(data.road_traffic_idx);

    updateTimestamps('traffic');

  } catch (error) {
    console.error("도로 소통 정보 수신 실패:", error);
    updateTimestamps('traffic');
  }
}

function updateTrafficData() {
  fetchTrafficData();
}

// ---------------- 대중교통 ----------------

async function fetchTransportData() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/city/transit/passenger?area_name=${TARGET_AREA_NAME}`
    );

    const transportBody = document.querySelector('#card-transport .card-body');
    if (!transportBody) return;

    if (!response.ok) {
      transportBody.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-sub); font-size: 12px;">
          대중교통 승하차 정보가 없습니다.
        </div>
      `;
      updateTimestamps('transport');
      return;
    }

    const data = await response.json();
    console.log("대중교통 승하차 데이터 수신:", data);

    // 기존 내용 초기화
    transportBody.innerHTML = '';

    if (!data || (!data.subway && !data.bus)) {
      transportBody.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-sub); font-size: 12px;">
          대중교통 승하차 데이터가 없습니다.
        </div>
      `;
      updateTimestamps('transport');
      return;
    }

    // 지하철 데이터 표시
    if (data.subway) {
      const subwayAvg = Math.round((data.subway.get_on_min + data.subway.get_on_max) / 2);
      const subwayOffAvg = Math.round((data.subway.get_off_min + data.subway.get_off_max) / 2);

      const subwayHtml = `
        <div class="public-row-line">
          <div class="public-icon-wrap subway">🚇</div>
          <div class="public-info">
            <div class="public-title">지하철</div>
            <div class="public-desc">오늘 누적 승하차</div>
          </div>
          <div class="transport-values">
            <div class="transport-row">
              <span class="transport-label-up">승차</span>
              <span class="transport-number">
                ${subwayAvg.toLocaleString('ko-KR')}
              </span>
            </div>
            <div class="transport-row">
              <span class="transport-label-down">하차</span>
              <span class="transport-number">
                ${subwayOffAvg.toLocaleString('ko-KR')}
              </span>
            </div>
          </div>
        </div>
      `;
      transportBody.insertAdjacentHTML('beforeend', subwayHtml);
    }

    // 버스 데이터 표시
    if (data.bus) {
      const busAvg = Math.round((data.bus.get_on_min + data.bus.get_on_max) / 2);
      const busOffAvg = Math.round((data.bus.get_off_min + data.bus.get_off_max) / 2);

      const busHtml = `
        <div class="public-row-line">
          <div class="public-icon-wrap bus">🚌</div>
          <div class="public-info">
            <div class="public-title">버스</div>
            <div class="public-desc">오늘 누적 승하차</div>
          </div>
          <div class="transport-values">
            <div class="transport-row">
              <span class="transport-label-up">승차</span>
              <span class="transport-number">
                ${busAvg.toLocaleString('ko-KR')}
              </span>
            </div>
            <div class="transport-row">
              <span class="transport-label-down">하차</span>
              <span class="transport-number">
                ${busOffAvg.toLocaleString('ko-KR')}
              </span>
            </div>
          </div>
        </div>
      `;
      transportBody.insertAdjacentHTML('beforeend', busHtml);
    }

    updateTimestamps('transport');

  } catch (error) {
    console.error("대중교통 정보 수신 실패:", error);

    const transportBody = document.querySelector('#card-transport .card-body');
    if (transportBody) {
      transportBody.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #ef4444; font-size: 12px;">
          대중교통 정보를 불러올 수 없습니다.
        </div>
      `;
    }
    updateTimestamps('transport');
  }
}

function updateTransportData() {
  fetchTransportData();
}

// ---------------- 실시간 돌발정보 ----------------

// 돌발 유형별 CSS 클래스 매핑 (카테고리 dot 색상용)
const INCIDENT_TYPE_CLASS_MAP = {
  'A01': 'accident',      // 교통사고
  'A04': 'construction',  // 공사
  'A10': 'event',         // 집회/행사
  'A02': 'breakdown',     // 차량고장
};

async function fetchIncidentsData() {
  try {
    const response = await fetch(`${API_BASE_URL}/incident/active`);
    if (!response.ok) throw new Error("Incident API Error");

    const incidents = await response.json();

    const incidentsContainer = document.querySelector('#card-incidents .card-body');
    if (!incidentsContainer) return;

    // 기존 내용 초기화
    incidentsContainer.innerHTML = '';

    if (!incidents || incidents.length === 0) {
      // 0건일 때
      incidentsContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-sub); font-size: 12px;">
          현재 진행 중인 돌발정보가 없습니다.
        </div>
      `;
    } else {
      // 1) 리스트 컨테이너(ul) 한 번 생성
      incidentsContainer.innerHTML = `
        <ul class="incident-list" id="incident-list"></ul>
      `;
      const listEl = document.getElementById('incident-list');
      listEl.innerHTML = '';

      // 2) 각 항목 li.incident-item 로 추가
      incidents.forEach(incident => {
        const incidentTime = getRelativeTime(incident.occr_date, incident.occr_time);

        // 매핑된 한글 유형 (예: "공사")
        const incidentType =
          ACC_TYPE_MAP[incident.acc_type] || incident.acc_type || '기타';

        const incidentIcon = getIncidentIcon(incident.acc_type);

        // 카테고리별 CSS 클래스 (dot 색상용)
        const dotClass = INCIDENT_TYPE_CLASS_MAP[incident.acc_type] || '';

        const detailText = incident.acc_info || '상세 정보 없음';

        const incidentHtml = `
          <li class="incident-item">
            <div class="incident-icon-block">
              <div class="incident-icon-circle">${incidentIcon}</div>
            </div>

            <div class="incident-main">
              <div class="incident-header">
                <div class="incident-type">
                  <span class="incident-type-dot ${dotClass}"></span>
                  <span>${incidentType}</span>
                </div>
                <div class="incident-time">${incidentTime}</div>
              </div>
              <div class="incident-detail">${detailText}</div>
            </div>
          </li>
        `;

        listEl.insertAdjacentHTML('beforeend', incidentHtml);
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
    const response = await fetch(
      `${API_BASE_URL}/city/weather/current?area_name=${TARGET_AREA_NAME}`
    );
    if (!response.ok) {
      console.log("기상현황 데이터 없음");
      updateTimestamps('weather');
      return;
    }

    const data = await response.json();
    console.log("기상현황 데이터 수신:", data);

    // 헤더의 날씨 정보 업데이트
    const weatherTemp = document.getElementById('weather-temp');
    const weatherIcon = document.getElementById('weather-icon');

    if (weatherTemp && data.temp !== undefined) {
      weatherTemp.textContent = `${data.temp}℃`;
    }

    // 날씨 아이콘 업데이트 (강수 형태 기반)
    if (weatherIcon) {
      let icon = '🌤️'; // 기본값

      if (data.precpt_type) {
        const precptType = data.precpt_type.toLowerCase();
        if (precptType.includes('비') || precptType.includes('rain')) {
          icon = '🌧️';
        } else if (precptType.includes('눈') || precptType.includes('snow')) {
          icon = '🌨️';
        } else if (precptType.includes('없음') || precptType === '-') {
          // 시간대에 따라 맑음/밤 아이콘 구분
          const hour = new Date().getHours();
          icon = (hour >= 6 && hour < 18) ? '☀️' : '🌙';
        }
      } else {
        // precpt_type이 없으면 시간대 기반
        const hour = new Date().getHours();
        icon = (hour >= 6 && hour < 18) ? '☀️' : '🌙';
      }

      weatherIcon.textContent = icon;
    }

    // 미세먼지/초미세먼지 정보 업데이트
    // API는 air_idx (통합 지수)와 air_idx_main (주요 오염물질)을 반환
    const pm10Status = document.getElementById('pm10-status');
    const pm25Status = document.getElementById('pm25-status');

    if (data.air_idx) {
      // 통합 대기질 지수를 PM10과 PM2.5 모두에 표시
      if (pm10Status) {
        pm10Status.textContent = data.air_idx;
      }
      if (pm25Status) {
        pm25Status.textContent = data.air_idx;
      }
    } else {
      console.warn('대기질 데이터 없음:', data);
    }

    updateTimestamps('weather');

  } catch (error) {
    console.error("기상현황 수신 실패:", error);
    updateTimestamps('weather');
  }
}

function updateWeatherData() {
  fetchWeatherData();
}

// ---------------- 문화행사 ----------------

async function fetchCultureData() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/city/events/cultural?area_name=${TARGET_AREA_NAME}&limit=5`
    );

    const cultureBody = document.querySelector('#card-culture .card-body .culture-list');
    if (!cultureBody) return;

    if (!response.ok) {
      cultureBody.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-sub); font-size: 12px;">
          문화·행사 정보를 불러올 수 없습니다.
        </div>
      `;
      updateTimestamps('culture');
      return;
    }

    const data = await response.json();
    console.log("문화행사 데이터 수신:", data);

    // 기존 내용 초기화
    cultureBody.innerHTML = '';

    if (!data || data.length === 0) {
      cultureBody.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-sub); font-size: 12px;">
          현재 진행 중인 문화·행사가 없습니다.
        </div>
      `;
      updateTimestamps('culture');
      return;
    }

    // 각 문화행사 항목 표시 (최대 5개)
    data.slice(0, 5).forEach(event => {
      const eventHtml = `
        <div class="culture-item">
          <div class="culture-title">${event.event_nm || '행사명 없음'}</div>
          <div class="culture-meta">
            ${event.event_period ? `<span>${event.event_period}</span>` : ''}
            ${event.event_place ? `<span>${event.event_place}</span>` : ''}
          </div>
        </div>
      `;
      cultureBody.insertAdjacentHTML('beforeend', eventHtml);
    });

    updateTimestamps('culture');

  } catch (error) {
    console.error("문화행사 정보 수신 실패:", error);

    const cultureBody = document.querySelector('#card-culture .card-body .culture-list');
    if (cultureBody) {
      cultureBody.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #ef4444; font-size: 12px;">
          문화·행사 정보를 불러올 수 없습니다.
        </div>
      `;
    }
    updateTimestamps('culture');
  }
}

function updateCultureData() {
  fetchCultureData();
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

  // 실시간율
  updateSystemHealth();
}

// 각 데이터별 갱신 인터벌 설정
function setupRefreshIntervals() {
  const now = new Date().getTime();

  // 각 데이터별 실행할 함수 정의
  const schedules = [
    { key: 'population', func: () => { fetchPopulationData(); fetchForecastData(); } },
    { key: 'subway', func: updateSubwayData },
    { key: 'traffic', func: updateTrafficData },
    { key: 'transport', func: updateTransportData },
    { key: 'weather', func: updateWeatherData },
    { key: 'incidents', func: updateIncidentsData },
    { key: 'culture', func: updateCultureData }
  ];

  schedules.forEach(item => {
    const interval = REFRESH_INTERVALS[item.key];
    // 다음 정각까지 남은 시간 계산 (예: 현재 12:00:40, 주기 1분 -> 20초 대기)
    const delay = interval - (now % interval);

    // 1. 첫 번째 실행은 "다음 정각"에 수행하도록 예약
    setTimeout(() => {
      item.func(); // 정각 실행
      // 2. 그 이후부터는 주기적으로 실행
      setInterval(item.func, interval);
    }, delay);
  });

  // UI 갱신 (실시간율, 카운트다운)은 1초마다 계속 실행
  setInterval(() => {
    updateCountdowns();
    updateSystemHealth();
  }, 1000);
}

// 초기화 실행 (DOM 로드 후)
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  setupRefreshIntervals();
  initPanelToggle();
  init3DToggleButton();
  initTransportDetailButton();
  fetchCctvLocations(); // CCTV 위치 데이터 로드
});

// ---------------- Google Map + CCTV 마커 ----------------

const SINNONHYEON = { lat: 37.50432, lng: 127.02453 };  // 신논현역 중심

let cctvLocations = [];
let map;

// CCTV 데이터를 API에서 가져오기
async function fetchCctvLocations() {
  const requestUrl = `${API_BASE_URL}/cctv/streams`; // 호출하려는 주소
  
  try {
    console.log(`[CCTV 요청] URL: ${requestUrl}`); // 1. 어떤 주소로 요청하는지 확인
    
    const response = await fetch(requestUrl);
    
    // 2. 상태 코드 확인 (404면 주소 틀림, 500이면 서버 오류)
    if (!response.ok) {
      console.error(`[CCTV 에러] 상태 코드: ${response.status}, 상태 메시지: ${response.statusText}`);
      return;
    }

    const result = await response.json();
    
    // 3. 데이터 구조 확인 (데이터가 비어있는지)
    if (!result.data) {
       console.warn("[CCTV 경고] 응답에 'data' 필드가 없습니다:", result);
       cctvLocations = [];
    } else {
       cctvLocations = result.data.map(cctv => ({
        id: cctv.id,
        name: cctv.name,
        lat: cctv.latitude,
        lng: cctv.longitude,
        stream_url: cctv.stream_url
      }));
    }

    if (map) {
      addCctvMarkers();
    }
  } catch (error) {
    console.error('CCTV 위치 데이터 로드 오류(네트워크/코드):', error);
  }
}

function initMap() {
  map = new google.maps.Map(document.getElementById("google-map"), {
    center: SINNONHYEON,
    zoom: 16,
    disableDefaultUI: true,
  });

  // CCTV 데이터 로드 후 마커 추가
  if (cctvLocations.length > 0) {
    addCctvMarkers();
  }
}

  // 전역 객체 연결
window.initMap = initMap;

function addCctvMarkers() {
  if (!map || cctvLocations.length === 0) return;

  const infoWindow = new google.maps.InfoWindow();

  cctvLocations.forEach((cctv) => {
    // 위도/경도가 없는 경우 스킵
    if (!cctv.lat || !cctv.lng) {
      console.warn(`CCTV ${cctv.name}: 위치 정보 없음`);
      return;
    }

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

  const cctv = cctvLocations.find(c => c.id === cctvId);
  if (!cctv) {
    console.error("CCTV를 찾을 수 없습니다:", cctvId);
    return;
  }

  const modal = document.getElementById('cctvModal');
  const titleEl = document.getElementById('cctvModalTitle');
  const videoContainer = document.getElementById('cctvVideoContainer');

  if (!modal || !titleEl || !videoContainer) return;

  titleEl.textContent = cctv.name;
  videoContainer.innerHTML = ''; // 초기화

  if (cctv.stream_url) {
    // 1. YouTube 링크인 경우
    if (cctv.stream_url.includes('youtube.com') || cctv.stream_url.includes('youtu.be')) {
      const videoId = extractYouTubeId(cctv.stream_url);
      videoContainer.innerHTML = `
        <iframe
          src="https://www.youtube.com/embed/${videoId}?autoplay=1"
          frameborder="0"
          allow="autoplay; encrypted-media"
          allowfullscreen
          style="width:100%; height:100%;"
        ></iframe>
      `;
    } 
    // 2. HLS(.m3u8) 스트림인 경우 (★수정된 부분★)
    else if (cctv.stream_url.includes('.m3u8')) {
      const video = document.createElement('video');
      video.style.width = '100%';
      video.style.height = '100%';
      video.controls = true;
      video.autoplay = true;
      video.muted = true; // 자동재생을 위해 음소거 필수

      videoContainer.appendChild(video);

      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(cctv.stream_url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          video.play().catch(e => console.log("자동재생 차단됨:", e));
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // 사파리(iOS/Mac)용 네이티브 지원
        video.src = cctv.stream_url;
        video.addEventListener('loadedmetadata', function() {
          video.play();
        });
      }
    } 
    // 3. 일반 MP4 등
    else {
      videoContainer.innerHTML = `
        <video controls autoplay muted style="width:100%; height:100%;">
          <source src="${cctv.stream_url}">
        </video>
      `;
    }
  } else {
    videoContainer.innerHTML = '<div class="cctv-error">CCTV URL 없음</div>';
  }

  modal.classList.add('is-open');
};

// YouTube URL에서 비디오 ID 추출
function extractYouTubeId(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

// CCTV 모달 닫기
function closeCctvModal() {
  const modal = document.getElementById('cctvModal');
  const videoContainer = document.getElementById('cctvVideoContainer');

  if (modal) {
    modal.classList.remove('is-open');
  }

  // 비디오 중지 (메모리 절약)
  if (videoContainer) {
    videoContainer.innerHTML = '<div class="cctv-loading">CCTV 스트림을 로딩 중...</div>';
  }
}

// 모달 닫기 이벤트 리스너 (DOM 로드 후 실행)
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('cctvModalClose');
  const overlay = document.getElementById('cctvModalOverlay');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeCctvModal);
  }

  if (overlay) {
    overlay.addEventListener('click', closeCctvModal);
  }

  // ESC 키로 모달 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCctvModal();
    }
  });
});

// ---------------- 패널 토글 시스템 ----------------

function initPanelToggle() {
  const chips = document.querySelectorAll('.chip');
  const panels = document.querySelectorAll('.overlay-panel');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const targetPanelId = chip.getAttribute('data-panel');
      const targetPanel = document.getElementById(targetPanelId);
      const isCurrentlyActive = chip.classList.contains('is-active');

      // 이미 활성화된 칩을 다시 클릭한 경우
      if (isCurrentlyActive) {
        // 칩과 패널 모두 비활성화
        chip.classList.remove('is-active');
        if (targetPanel) {
          targetPanel.classList.remove('is-active');
        }
      } else {
        // 다른 칩을 클릭한 경우
        // 모든 칩에서 is-active 제거
        chips.forEach(c => c.classList.remove('is-active'));

        // 클릭된 칩에 is-active 추가
        chip.classList.add('is-active');

        // 모든 패널 숨기기
        panels.forEach(panel => {
          panel.classList.remove('is-active');
        });

        // 선택된 패널만 표시
        if (targetPanel) {
          // 약간의 딜레이 후 애니메이션 적용
          setTimeout(() => {
            targetPanel.classList.add('is-active');
          }, 50);
        }
      }
    });
  });
}

// ==============================================
// 1. 구글맵 2D ↔ 3D 변환 기능
// ==============================================

let is3DMode = false; // 현재 3D 모드 여부를 추적

/**
 * 구글맵 2D/3D 모드 전환 함수
 * - 2D → 3D: 45도 틸트 + 회전 가능 활성화
 * - 3D → 2D: 틸트 0도 + 기본 뷰로 복귀
 * - 현재 중심 좌표와 줌 레벨 유지
 */
function toggle3DMode() {
  const button = document.getElementById('toggle3DButton');
  const btnText = button.querySelector('.btn-text');
  const btnIcon = button.querySelector('.btn-icon');

  if (!map) {
    console.error('지도 객체가 초기화되지 않았습니다.');
    return;
  }

  // 현재 지도 중심과 줌 레벨 저장
  const currentCenter = map.getCenter();
  const currentZoom = map.getZoom();

  if (!is3DMode) {
    // 2D → 3D 전환
    map.setMapTypeId(google.maps.MapTypeId.SATELLITE); // 위성 뷰로 변경
    map.setTilt(45); // 45도 기울임

    // 줌 레벨을 18 이상으로 설정해야 3D 건물이 보임
    if (currentZoom < 18) {
      map.setZoom(18);
    }

    // 버튼 상태 변경
    button.classList.add('is-3d');
    btnText.textContent = '2D 변환';
    btnIcon.textContent = '🌐';
    is3DMode = true;

  } else {
    // 3D → 2D 전환
    map.setMapTypeId(google.maps.MapTypeId.ROADMAP); // 일반 지도로 변경
    map.setTilt(0); // 틸트 제거

    // 버튼 상태 변경
    button.classList.remove('is-3d');
    btnText.textContent = '3D 변환';
    btnIcon.textContent = '🗺️';
    is3DMode = false;

    // 원래 줌 레벨로 복원
    map.setZoom(currentZoom);
  }

  // 중심 좌표 복원
  map.setCenter(currentCenter);
}

/**
 * 2D/3D 토글 버튼 초기화
 */
function init3DToggleButton() {
  const button = document.getElementById('toggle3DButton');
  if (button) {
    button.addEventListener('click', toggle3DMode);
  }
}

// ==============================================
// 3. 대중교통 승하차 상세보기 그래프 기능
// ==============================================

let transportChart = null; // Chart.js 인스턴스 저장

/**
 * 대중교통 상세 데이터 가져오기
 * API에서 시간대별 승하차 데이터를 받아옴
 */
async function fetchTransportDetail() {
  const chartContainer = document.querySelector('.chart-container');

  // 로딩 표시
  chartContainer.innerHTML = '<div class="chart-loading">데이터 로딩 중...</div><canvas id="transportChart"></canvas>';

  try {
    // 먼저 현재 승하차 데이터를 사용해서 샘플 그래프 생성
    // 실제 API가 없으면 더미 데이터로 그래프 생성
    const response = await fetch(`${API_BASE_URL}/city/transit/hourly?area_name=${TARGET_AREA_NAME}`);

    let data;

    if (!response.ok) {
      console.warn('시간대별 API 응답 없음, 더미 데이터로 대체');
      // 더미 데이터 생성 (0시부터 23시까지)
      data = Array.from({ length: 24 }, (_, i) => ({
        time_slot: String(i).padStart(2, '0'),
        subway: {
          get_on_min: Math.floor(Math.random() * 5000) + 1000,
          get_on_max: Math.floor(Math.random() * 5000) + 6000,
          get_off_min: Math.floor(Math.random() * 5000) + 1000,
          get_off_max: Math.floor(Math.random() * 5000) + 6000
        },
        bus: {
          get_on_min: Math.floor(Math.random() * 3000) + 500,
          get_on_max: Math.floor(Math.random() * 3000) + 3500,
          get_off_min: Math.floor(Math.random() * 3000) + 500,
          get_off_max: Math.floor(Math.random() * 3000) + 3500
        }
      }));
    } else {
      data = await response.json();

      // 데이터 검증
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn('빈 데이터 응답, 더미 데이터로 대체');
        data = Array.from({ length: 24 }, (_, i) => ({
          time_slot: String(i).padStart(2, '0'),
          subway: {
            get_on_min: Math.floor(Math.random() * 5000) + 1000,
            get_on_max: Math.floor(Math.random() * 5000) + 6000,
            get_off_min: Math.floor(Math.random() * 5000) + 1000,
            get_off_max: Math.floor(Math.random() * 5000) + 6000
          },
          bus: {
            get_on_min: Math.floor(Math.random() * 3000) + 500,
            get_on_max: Math.floor(Math.random() * 3000) + 3500,
            get_off_min: Math.floor(Math.random() * 3000) + 500,
            get_off_max: Math.floor(Math.random() * 3000) + 3500
          }
        }));
      }
    }

    // 시간대별 데이터 추출
    const timeLabels = data.map(item => {
      const hour = item.time_slot || item.hour || '00';
      return `${hour}시`;
    });

    const subwayBoardings = data.map(item => {
      const subway = item.subway || {};
      return Math.round((subway.get_on_min + subway.get_on_max) / 2) || 0;
    });

    const subwayAlightings = data.map(item => {
      const subway = item.subway || {};
      return Math.round((subway.get_off_min + subway.get_off_max) / 2) || 0;
    });

    const busBoardings = data.map(item => {
      const bus = item.bus || {};
      return Math.round((bus.get_on_min + bus.get_on_max) / 2) || 0;
    });

    const busAlightings = data.map(item => {
      const bus = item.bus || {};
      return Math.round((bus.get_off_min + bus.get_off_max) / 2) || 0;
    });

    console.log('그래프 데이터:', {
      timeLabels,
      subwayBoardings,
      subwayAlightings,
      busBoardings,
      busAlightings
    });

    // 그래프 그리기
    drawTransportChart({
      time_labels: timeLabels,
      subway_boardings: subwayBoardings,
      subway_alightings: subwayAlightings,
      bus_boardings: busBoardings,
      bus_alightings: busAlightings
    });

  } catch (error) {
    console.error('대중교통 상세 데이터 오류:', error);
    chartContainer.innerHTML = `<div class="chart-loading" style="color: #ef4444;">데이터를 불러올 수 없습니다<br/><small>${error.message}</small></div>`;
  }
}

/**
 * Chart.js를 사용하여 승하차 그래프 그리기
 * @param {Object} data - API에서 받아온 데이터
 */
function drawTransportChart(data) {
  const canvas = document.getElementById('transportChart');
  if (!canvas) return;

  // 기존 차트가 있다면 제거
  if (transportChart) {
    transportChart.destroy();
  }

  const ctx = canvas.getContext('2d');

  // Chart.js 설정
  transportChart = new Chart(ctx, {
    type: 'line', // 점선 그래프
    data: {
      labels: data.time_labels, // X축: 시간대
      datasets: [
        {
          label: '지하철 승차',
          data: data.subway_boardings,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2.5,
          tension: 0.3,
        },
        {
          label: '지하철 하차',
          data: data.subway_alightings,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.15)',
          pointBackgroundColor: '#60a5fa',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2.5,
          tension: 0.3,
        },
        {
          label: '버스 승차',
          data: data.bus_boardings,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2.5,
          tension: 0.3,
        },
        {
          label: '버스 하차',
          data: data.bus_alightings,
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.15)',
          pointBackgroundColor: '#34d399',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2.5,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false, // 범례는 별도로 표시
        },
        tooltip: {
          backgroundColor: '#111827',
          titleColor: '#f9fafb',
          bodyColor: '#f9fafb',
          borderColor: '#111827',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y.toLocaleString()}명`;
            }
          }
        },
      },
      layout: {
        padding: { left: 0, right: 4, top: 4, bottom: 4 }
      },
      scales: {
        x: {
          grid: {
            color: '#e5e7eb',
            drawBorder: false,
          },
          ticks: {
            color: '#6b7280',
            font: {
              size: 11,
              weight: '500',
            },
            maxRotation: 45,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: '#e5e7eb',
            drawBorder: false,
          },
          border: {
            color: '#d1d5db'
          },
          ticks: {
            color: '#6b7280',
            font: {
              size: 11,
              weight: '500',
            },
            callback: function(value) {
              return value.toLocaleString() + '명';
            },
          },
          title: {
            display: true,
            text: '승하차 인원',
            color: '#374151',
            font: {
              size: 12,
              weight: '600',
            },
          },
        },
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
    },
  });
}

/**
 * 상세보기 패널 열기
 */
function openTransportDetail() {
  const detailSection = document.getElementById('transportDetailSection');
  const button = document.getElementById('transportDetailButton');
  const card = document.getElementById('card-transport');

  if (detailSection) {
    detailSection.style.display = 'block';
    button.textContent = '닫기 ›';

    // 카드 너비 확장
    if (card) {
      card.classList.add('detail-expanded');
    }

    // 데이터 가져오기
    fetchTransportDetail();
  }
}

/**
 * 상세보기 패널 닫기
 */
function closeTransportDetail() {
  const detailSection = document.getElementById('transportDetailSection');
  const button = document.getElementById('transportDetailButton');
  const card = document.getElementById('card-transport');

  if (detailSection) {
    detailSection.style.display = 'none';
    button.textContent = '상세보기 ›';

    // 카드 너비 원래대로
    if (card) {
      card.classList.remove('detail-expanded');
    }

    // 차트 인스턴스 제거
    if (transportChart) {
      transportChart.destroy();
      transportChart = null;
    }
  }
}

/**
 * 상세보기 버튼 토글
 */
function toggleTransportDetail() {
  const detailSection = document.getElementById('transportDetailSection');

  if (detailSection.style.display === 'none' || !detailSection.style.display) {
    openTransportDetail();
  } else {
    closeTransportDetail();
  }
}

/**
 * 대중교통 상세보기 버튼 초기화
 */
function initTransportDetailButton() {
  const detailButton = document.getElementById('transportDetailButton');
  const closeButton = document.getElementById('closeDetailButton');

  if (detailButton) {
    detailButton.addEventListener('click', toggleTransportDetail);
  }

  if (closeButton) {
    closeButton.addEventListener('click', closeTransportDetail);
  }
}

