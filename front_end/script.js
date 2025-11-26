// -------------------------- config --------------------------

const API_BASE_URL = "http://localhost:58000";
const TARGET_AREA_NAME = "강남역"

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
        popChangeEl.style.color = "#dc2626"; // 빨간색
      } else if (changePercent < 0) {
        popChangeEl.textContent = `▼ ${Math.abs(changePercent)}%`;
        popChangeEl.style.color = "#2563eb"; // 파란색
      } else {
        popChangeEl.textContent = "0%";
        popChangeEl.style.color = "#6b7280"; // 회색
      }
    } else if (popChangeEl) {
      popChangeEl.textContent = "-";
      popChangeEl.style.color = "#9ca3af";
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

// ---------------- 예측 데이터 ----------------

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
    console.log("향후 6시간 데이터:", next6);

    const values = next6.map((d) => d.fcst_max);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;
    console.log(`그래프 범위: ${minVal} ~ ${maxVal}, range: ${range}`);

    next6.forEach((item, index) => {
      const fTime = new Date(item.fcst_time);
      const hourLabel = fTime.getHours() + "시";
      const styleInfo = getColorByLevel(item.fcst_congest_lvl);

      let heightPercent = 100;
      if (range > 0) {
        const ratio = (item.fcst_max - minVal) / range;
        heightPercent = 20 + ratio * 80;
      }

      console.log(`${hourLabel} | ${item.fcst_congest_lvl} | 높이: ${heightPercent.toFixed(1)}% | 색상: ${styleInfo.color}`);

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

    console.log("예측 그래프 렌더링 완료!");
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
      '원활': { color: '#10b981', text: '원활' },
      '서행': { color: '#f59e0b', text: '서행' },
      '정체': { color: '#ef4444', text: '정체' }
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
            <div class="transport-up">▲ ${subwayAvg.toLocaleString('ko-KR')}</div>
            <div class="transport-down">▼ ${subwayOffAvg.toLocaleString('ko-KR')}</div>
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
            <div class="transport-up">▲ ${busAvg.toLocaleString('ko-KR')}</div>
            <div class="transport-down">▼ ${busOffAvg.toLocaleString('ko-KR')}</div>
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

async function fetchIncidentsData() {
  try {
    const response = await fetch(`${API_BASE_URL}/incident/active`);
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
      // 여기가 매핑된 한글 유형 (예: "공사")
      const incidentType = ACC_TYPE_MAP[incident.acc_type] || incident.acc_type || '기타';
      const incidentIcon = getIncidentIcon(incident.acc_type);
      
      const incidentHtml = `
        <div class="incident-item">
          <div class="incident-icon-block">
            <div class="incident-icon-circle">${incidentIcon}</div>
          </div>

          <div class="incident-main">
            <div class="incident-header">
              <div class="incident-type">${incidentType}</div>
              <div class="incident-time">${incidentTime}</div>
            </div>
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
    const weatherTemp = document.querySelector('.weather-temp');
    const weatherIcon = document.querySelector('.weather-icon');

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

    // 미세먼지/초미세먼지 정보 업데이트 (데이터가 있다면)
    const airLabels = document.querySelectorAll('.air-value');
    if (airLabels.length >= 2) {
      if (data.pm10_status) airLabels[0].textContent = data.pm10_status;
      if (data.pm25_status) airLabels[1].textContent = data.pm25_status;
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
});

// ---------------- Google Map + CCTV 마커 ----------------

const CCTV_LOCATIONS = [
  { id: 1, name: "강남역 10번 출구", lat: 37.498006, lng: 127.02762 },
  { id: 2, name: "강남역 11번 출구", lat: 37.49772, lng: 127.02845 },
  { id: 3, name: "강남대로 횡단보도 앞", lat: 37.4985, lng: 127.0268 },
];

let map;

function initMap() {
  // 강남역 기준에서 약간 위로 조정하여 UI 밸런스 개선
  const gangnam = { lat: 37.4985, lng: 127.0276 };

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

