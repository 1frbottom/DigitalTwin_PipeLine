// ---------------- 갱신 시간 관리 ----------------

// 각 카드별 갱신 간격 (밀리초)
const REFRESH_INTERVALS = {
  population: 10000,      // 10초
  traffic: 15000,         // 15초
  transport: 20000,       // 20초
  livingPop: 60000,       // 1분
  safety: 10000,          // 10초
  prediction: 30000,      // 30초
  retail: 300000,         // 5분
  events: 5000,           // 5초
  culture: 3600000,       // 1시간
  toilet: 86400000,       // 24시간
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
    updateTimestamps('pop');

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
        "<span style='font-size:11px; color:#9ca3af; width:100%; text-align:center;'>예측 데이터 없음</span>";
      return;
    }

    const list = await response.json();

    if (!list || list.length === 0) {
      container.innerHTML =
        "<span style='font-size:11px; color:#9ca3af; width:100%; text-align:center;'>예측 데이터 준비중</span>";
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

// ---------------- 도로 소통 ----------------

function updateTrafficData() {
  updateTimestamps('traffic');
}

// ---------------- 대중교통 ----------------

function updateTransportData() {
  updateTimestamps('transport');
}

// ---------------- 실시간 돌발정보 ----------------

function updateIncidentsData() {
  updateTimestamps('incidents');
}

// ---------------- 안전지수 ----------------

function updateSafetyData() {
  updateTimestamps('safety');
}

// ---------------- 예측 ----------------

function updatePredictionData() {
  updateTimestamps('prediction');
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
  
  // 기타 데이터 (실제 API 연동 시 각각의 함수 구현)
  updateTrafficData();
  updateTransportData();
  updateIncidentsData();
  updateSafetyData();
  updatePredictionData();
  updateCultureData();
}

// 각 데이터별 갱신 인터벌 설정
function setupRefreshIntervals() {
  setInterval(() => {
    fetchPopulationData();
    fetchForecastData();
  }, REFRESH_INTERVALS.population);

  setInterval(updateTrafficData, REFRESH_INTERVALS.traffic);
  setInterval(updateTransportData, REFRESH_INTERVALS.transport);
  setInterval(updateIncidentsData, REFRESH_INTERVALS.events); // 돌발정보는 5초마다
  setInterval(updateSafetyData, REFRESH_INTERVALS.safety);
  setInterval(updatePredictionData, REFRESH_INTERVALS.prediction);
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