-- 실시간 도로소통 (삭제예정)
CREATE TABLE IF NOT EXISTS traffic_data (
    link_id VARCHAR(50) NOT NULL,
    avg_speed DOUBLE PRECISION,
    travel_time INTEGER,
    timestamp DOUBLE PRECISION,
    PRIMARY KEY (link_id, timestamp)
);

CREATE TABLE IF NOT EXISTS cctv_streams (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    stream_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cctv_streams (id, name, stream_url) VALUES
    ('1', '강남역', 'https://strm2.spatic.go.kr/live/207.stream/chunklist_w1500799502.m3u8'),
    ('2', '강남대로', 'https://kakaocctv-cache.loomex.net/lowStream/_definst_/9999_low.stream/playlist.m3u8'),
    ('3', '신논현역', 'https://strm3.spatic.go.kr/live/289.stream/playlist.m3u8'),
    ('4', '논현역', 'https://strm2.spatic.go.kr/live/206.stream/playlist.m3u8')
ON CONFLICT (id) DO NOTHING;

-- 실시간 돌발정보
CREATE TABLE IF NOT EXISTS traffic_incidents (
    acc_id VARCHAR(50) NOT NULL,
    occr_date VARCHAR(8),
    occr_time VARCHAR(6),
    exp_clr_date VARCHAR(8),
    exp_clr_time VARCHAR(6),
    acc_type VARCHAR(10), 
    acc_dtype VARCHAR(10),
    link_id VARCHAR(50),
    grs80tm_x DOUBLE PRECISION,
    grs80tm_y DOUBLE PRECISION,
    acc_info TEXT,
    timestamp DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (acc_id, timestamp)
);

-- 실시간 도시데이터
CREATE TABLE IF NOT EXISTS city_data_raw (
    area_nm VARCHAR(50) NOT NULL,
    area_cd VARCHAR(20) NOT NULL,
    timestamp DOUBLE PRECISION NOT NULL,
    live_ppltn_stts TEXT,
    road_traffic_stts TEXT,
    prk_stts TEXT,
    sub_stts TEXT,
    live_sub_ppltn TEXT,
    bus_stn_stts TEXT,
    live_bus_ppltn TEXT,
    acdnt_cntrl_stts TEXT,
    sbike_stts TEXT,
    weather_stts TEXT,
    charger_stts TEXT,
    event_stts TEXT,
    live_cmrcl_stts TEXT,
    live_dst_message TEXT,
    live_yna_news TEXT,
    PRIMARY KEY (area_nm, timestamp)
);

-- 실시간 도시데이터 : 인구현황
CREATE TABLE IF NOT EXISTS city_live_ppltn_proc (
    area_nm VARCHAR(50) NOT NULL,    
    congest_lvl VARCHAR(50),              
    congest_msg TEXT,
    ppltn_min INTEGER,
    ppltn_max INTEGER,                    
    ppltn_time TIMESTAMP NOT NULL,
    fcst_yn VARCHAR(1),
    ingest_timestamp DOUBLE PRECISION,
    PRIMARY KEY (area_nm, ppltn_time)
);

-- 실시간 도시데이터 : 인구현황(예측)
CREATE TABLE IF NOT EXISTS city_live_ppltn_forecast (
    area_nm VARCHAR(50) NOT NULL,
    base_ppltn_time TIMESTAMP NOT NULL,
    fcst_time TIMESTAMP NOT NULL,   
    fcst_congest_lvl VARCHAR(50),       
    fcst_min INTEGER,             
    fcst_max INTEGER,       
    PRIMARY KEY (area_nm, base_ppltn_time, fcst_time)
);

-- 실시간 도시데이터 : 도로소통 현황(평균)
CREATE TABLE IF NOT EXISTS city_road_traffic_stts_avg (
    area_nm VARCHAR(50) NOT NULL,
    road_msg TEXT,
    road_traffic_idx VARCHAR(50),
    road_traffic_spd INTEGER,
    road_traffic_time TIMESTAMP NOT NULL,
    ingest_timestamp DOUBLE PRECISION,
    PRIMARY KEY (area_nm, road_traffic_time)
);