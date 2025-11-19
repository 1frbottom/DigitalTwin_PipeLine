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

CREATE TABLE IF NOT EXISTS city_data_raw (
    area_nm VARCHAR(50) NOT NULL,
    area_cd VARCHAR(20) NOT NULL,
    timestamp DOUBLE PRECISION NOT NULL,
    live_ppltn_stts TEXT,
    live_cmrcl_stts TEXT,
    road_traffic_stts TEXT,
    prk_stts TEXT,
    sub_stts TEXT,
    live_sub_ppltn TEXT,
    bus_stn_stts TEXT,
    acdnt_cntrl_stts TEXT,
    charger_stts TEXT,
    sbike_stts TEXT,
    weather_stts TEXT,
    event_stts TEXT,
    live_dst_message TEXT,
    live_yna_news TEXT,
    PRIMARY KEY (area_nm, timestamp)
);

CREATE TABLE IF NOT EXISTS live_ppltn_proc (
    area_nm VARCHAR(50) NOT NULL,    
    congest_lvl VARCHAR(50),              
    congest_msg TEXT,                    
    ppltn_time TIMESTAMP NOT NULL,
    fcst_yn VARCHAR(1),
    ingest_timestamp DOUBLE PRECISION,
    PRIMARY KEY (area_nm, ppltn_time)
);

CREATE TABLE IF NOT EXISTS live_ppltn_forecast (
    area_nm VARCHAR(50) NOT NULL,
    base_ppltn_time TIMESTAMP NOT NULL,
    fcst_time TIMESTAMP NOT NULL,
    fcst_congest_lvl VARCHAR(50),
    fcst_min INTEGER,
    fcst_max INTEGER,
    PRIMARY KEY (area_nm, base_ppltn_time, fcst_time)
);

CREATE TABLE IF NOT EXISTS subway_arrival_proc (
    area_nm VARCHAR(50) NOT NULL,
    station_nm VARCHAR(100) NOT NULL,
    line_num VARCHAR(10) NOT NULL,
    train_line_nm VARCHAR(100) NOT NULL,
    arrival_msg_1 TEXT,
    arrival_msg_2 TEXT,
    ingest_timestamp TIMESTAMP NOT NULL,
    PRIMARY KEY (area_nm, station_nm, line_num, train_line_nm, ingest_timestamp)
);

CREATE INDEX idx_subway_station ON subway_arrival_proc(station_nm);
CREATE INDEX idx_subway_area ON subway_arrival_proc(area_nm);
CREATE INDEX idx_subway_line ON subway_arrival_proc(line_num);
CREATE INDEX idx_subway_timestamp ON subway_arrival_proc(ingest_timestamp);

CREATE TABLE IF NOT EXISTS subway_ppltn_proc (
    area_nm VARCHAR(50) NOT NULL,
    -- 5분 이내 승하차 데이터만
    wthn_5_gton_min INTEGER,
    wthn_5_gton_max INTEGER,
    wthn_5_gtoff_min INTEGER,
    wthn_5_gtoff_max INTEGER,
    -- 메타 데이터
    stn_cnt INTEGER,
    stn_time VARCHAR(14),
    ingest_timestamp TIMESTAMP NOT NULL,
    PRIMARY KEY (area_nm, ingest_timestamp)
);

CREATE INDEX idx_subway_ppltn_area ON subway_ppltn_proc(area_nm);
CREATE INDEX idx_subway_ppltn_time ON subway_ppltn_proc(ingest_timestamp);

-- 24시간 이전 데이터 자동 삭제 함수
CREATE OR REPLACE FUNCTION delete_old_subway_ppltn()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM subway_ppltn_proc
    WHERE ingest_timestamp < NOW() - INTERVAL '24 hours';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- INSERT 시마다 24시간 이전 데이터 삭제 트리거
CREATE TRIGGER trigger_delete_old_subway_ppltn
AFTER INSERT ON subway_ppltn_proc
FOR EACH STATEMENT
EXECUTE FUNCTION delete_old_subway_ppltn();