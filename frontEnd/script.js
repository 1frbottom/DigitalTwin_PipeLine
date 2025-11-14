// ========================================
// 설정
// ========================================
const CONFIG = {
    AUTO_LOAD_CCTV: true,  // CCTV 자동 로드 (false로 변경하면 비활성화)
    AUTO_PLAY_CCTV: true   // CCTV 자동 재생 (false로 변경하면 비활성화)
};

const API_BASE_URL = `http://${window.location.hostname}:8000`;

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

// 1. 최근 교통 데이터
async function getRecentTraffic() {
    const resultDiv = document.getElementById('recent-response');
    const statusDiv = document.getElementById('recent-status');
    
    resultDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    statusDiv.innerHTML = '로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';
    
    const minutes = document.getElementById('minutes').value || 10;
    const limit = document.getElementById('limit').value || 100;
    
    const result = await fetchAPI('/api/traffic/recent', { minutes, limit, skip: 0 });
    
    if (result.status === 200) {
        statusDiv.innerHTML = '성공';
        statusDiv.className = 'status success';
        resultDiv.innerHTML = `<span class="success">데이터 개수: ${result.data.length}</span>\n\n${JSON.stringify(result.data, null, 2)}`;
    } else {
        statusDiv.innerHTML = '실패';
        statusDiv.className = 'status error';
        resultDiv.innerHTML = `<span class="error">Error: ${result.error || result.data}</span>`;
    }
}

// 2. 특정 링크 데이터
async function getTrafficByLink() {
    const resultDiv = document.getElementById('link-response');
    const statusDiv = document.getElementById('link-status');
    const linkId = document.getElementById('linkId').value;
    
    if (!linkId) {
        alert('링크 ID를 입력하세요');
        return;
    }
    
    resultDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    statusDiv.innerHTML = '로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';
    
    const result = await fetchAPI(`/api/traffic/link/${linkId}`, { limit: 50 });
    
    if (result.status === 200) {
        statusDiv.innerHTML = '성공';
        statusDiv.className = 'status success';
        resultDiv.innerHTML = `<span class="success">데이터 개수: ${result.data.length}</span>\n\n${JSON.stringify(result.data, null, 2)}`;
    } else {
        statusDiv.innerHTML = '실패';
        statusDiv.className = 'status error';
        resultDiv.innerHTML = `<span class="error">Error: ${result.error || JSON.stringify(result.data)}</span>`;
    }
}

// 3. 통계 데이터
async function getTrafficStats() {
    const resultDiv = document.getElementById('stats-response');
    const tableDiv = document.getElementById('stats-table');
    const statusDiv = document.getElementById('stats-status');
    
    resultDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    statusDiv.innerHTML = '로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';
    
    const result = await fetchAPI('/api/traffic/stats');
    
    if (result.status === 200) {
        statusDiv.innerHTML = '성공';
        statusDiv.className = 'status success';
        resultDiv.innerHTML = `<span class="success">링크 개수: ${result.data.length}</span>\n\n${JSON.stringify(result.data, null, 2)}`;
        
        // 테이블로도 표시
        let tableHTML = '<table><tr><th>링크 ID</th><th>평균 속도</th><th>데이터 수</th></tr>';
        result.data.forEach(item => {
            tableHTML += `<tr><td>${item.link_id}</td><td>${item.avg_speed_mean.toFixed(2)} km/h</td><td>${item.count}</td></tr>`;
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

// 4. 헬스 체크
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

// 5. CCTV 스트리밍
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

// 페이지 로드 시 자동 실행 (설정에 따라)
window.addEventListener('DOMContentLoaded', function() {
    if (CONFIG.AUTO_LOAD_CCTV) {
        console.log('페이지 로드 완료, CCTV 스트림 자동 로드 시작...');
        loadCCTVStreams();
    }
});
