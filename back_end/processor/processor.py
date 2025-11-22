from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, to_timestamp, explode, date_trunc, coalesce, get_json_object
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType, ArrayType



spark = SparkSession.builder \
    .appName("TrafficDataProcessor") \
    .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.1,org.postgresql:postgresql:42.6.0") \
    .getOrCreate()

db_properties = {
    "url": "jdbc:postgresql://db:5432/traffic_db",
    "user": "user",
    "password": "password",
    "driver": "org.postgresql.Driver"
}

# --- 1. traffic_incidents 스트림 -----------------------------
incident_schema = StructType([
    StructField("acc_id", StringType(), False),
    StructField("occr_date", StringType(), True),
    StructField("occr_time", StringType(), True),
    StructField("exp_clr_date", StringType(), True),
    StructField("exp_clr_time", StringType(), True),
    StructField("acc_type", StringType(), True),
    StructField("acc_dtype", StringType(), True),
    StructField("link_id", StringType(), True),
    StructField("grs80tm_x", StringType(), True), 
    StructField("grs80tm_y", StringType(), True),
    StructField("acc_info", StringType(), True),
    StructField("timestamp", DoubleType(), True)
])

incident_stream_df = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:29092") \
    .option("subscribe", "traffic-incidents") \
    .option("startingOffsets", "earliest") \
    .load()

parsed_incident_df = incident_stream_df.select(from_json(col("value").cast("string"), incident_schema).alias("data")).select(
    col("data.acc_id").alias("acc_id"),
    col("data.occr_date").alias("occr_date"),
    col("data.occr_time").alias("occr_time"),
    col("data.exp_clr_date").alias("exp_clr_date"),
    col("data.exp_clr_time").alias("exp_clr_time"),
    col("data.acc_type").alias("acc_type"),
    col("data.acc_dtype").alias("acc_dtype"),
    col("data.link_id").alias("link_id"),
    col("data.grs80tm_x").cast(DoubleType()).alias("grs80tm_x"), 
    col("data.grs80tm_y").cast(DoubleType()).alias("grs80tm_y"),
    col("data.acc_info").alias("acc_info"),
    col("data.timestamp").alias("timestamp")
)

def write_incident_to_postgres(df, epoch_id):
    
    if df.rdd.isEmpty():
            return
    
    # 배치 내 중복 데이터 제거
    df_dedup = df.dropDuplicates(['acc_id', 'timestamp'])
        
    df_dedup.write \
        .format("jdbc") \
        .options(**db_properties) \
        .option("dbtable", "traffic_incidents") \
        .mode("append") \
        .save()

query_incident = parsed_incident_df.writeStream \
    .foreachBatch(write_incident_to_postgres) \
    .start()

# --- 2. city_data_raw 스트림 ------------------------------
schema_city_data = StructType([
    StructField("area_nm", StringType(), False),
    StructField("area_cd", StringType(), False),
    StructField("timestamp", DoubleType(), True),
    StructField("live_ppltn_stts", StringType(), True),
    StructField("road_traffic_stts", StringType(), True),
    StructField("prk_stts", StringType(), True),
    StructField("sub_stts", StringType(), True),
    StructField("live_sub_ppltn", StringType(), True),
    StructField("bus_stn_stts", StringType(), True),
    StructField("live_bus_ppltn", StringType(), True),
    StructField("acdnt_cntrl_stts", StringType(), True),
    StructField("sbike_stts", StringType(), True),
    StructField("weather_stts", StringType(), True),
    StructField("charger_stts", StringType(), True),
    StructField("event_stts", StringType(), True),
    StructField("live_cmrcl_stts", StringType(), True),
    StructField("live_dst_message", StringType(), True),
    StructField("live_yna_news", StringType(), True)
])

stream_df_city_data = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:29092") \
    .option("subscribe", "city-data") \
    .option("startingOffsets", "earliest") \
    .load()

parsed_stream_df_city_data = stream_df_city_data.select(from_json(col("value").cast("string"), schema_city_data).alias("data")).select("data.*")

def write_citydata_to_postgres(df, epoch_id):
    
    if df.rdd.isEmpty():
        return
    
    # [수정] 중복 제거
    df_dedup = df.dropDuplicates(['area_nm', 'timestamp'])
    
    df_dedup.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "city_data_raw") \
      .mode("append") \
      .save()

query_city_data = parsed_stream_df_city_data.writeStream \
    .foreachBatch(write_citydata_to_postgres) \
    .start()


# --- 2-1. city_data_raw의 live_ppltn_stts 스트림 --------

    # FCST_PPLTN (N) 부분의 스키마
schema_fcst_item = StructType([
    StructField("FCST_TIME", StringType(), True),
    StructField("FCST_CONGEST_LVL", StringType(), True),
    StructField("FCST_PPLTN_MIN", StringType(), True), 
    StructField("FCST_PPLTN_MAX", StringType(), True)
])

    # FCST_PPLTN 부모 객체의 스키마
schema_fcst_parent = StructType([
    StructField("FCST_PPLTN", ArrayType(schema_fcst_item), True)
])

    # LIVE_PPLTN_STTS (1) 부분의 "내부" 스키마
schema_inner_ppltn = StructType([
    StructField("AREA_CONGEST_LVL", StringType(), True),
    StructField("AREA_CONGEST_MSG", StringType(), True),
    StructField("AREA_PPLTN_MIN", StringType(), True),
    StructField("AREA_PPLTN_MAX", StringType(), True),
    StructField("PPLTN_TIME", StringType(), True),
    StructField("FCST_YN", StringType(), True),
    StructField("FCST_PPLTN", schema_fcst_parent, True) 
])

    # LIVE_PPLTN_STTS (1) 부분의 "외부" 스키마
schema_outer_ppltn = StructType([
    StructField("LIVE_PPLTN_STTS", schema_inner_ppltn, True)
])

    # `city_data_raw` 스트림에서 `live_ppltn_stts`(JSON 문자열) 필드를 가져와 파싱합니다.
parsed_ppltn_df = parsed_stream_df_city_data \
    .filter(col("live_ppltn_stts").isNotNull()) \
    .select(
        col("area_nm"),
        col("timestamp").alias("ingest_timestamp"), # 원본 수집 시각
        # "외부" 스키마(schema_outer_ppltn)로 파싱합니다.
        from_json(col("live_ppltn_stts"), schema_outer_ppltn).alias("ppltn_data_outer")
    ) \
    .select(
        "area_nm",
        "ingest_timestamp",
        # 파싱된 객체에서 "내부" 데이터의 필드들만 꺼내서 펼칩니다.
        col("ppltn_data_outer.LIVE_PPLTN_STTS.*") 
    )

    # (테이블 1) 1:1 현황 데이터 (city_live_ppltn_proc) 준비
    # PPLTN_TIME (문자열)을 PostgreSQL TIMESTAMP 타입으로 변환
proc_df = parsed_ppltn_df \
    .select(
        "area_nm",
        "ingest_timestamp",
        to_timestamp(col("PPLTN_TIME"), "yyyy-MM-dd HH:mm").alias("ppltn_time"),
        col("AREA_CONGEST_LVL").alias("congest_lvl"),
        col("AREA_CONGEST_MSG").alias("congest_msg"),
        col("AREA_PPLTN_MIN").cast(IntegerType()).alias("ppltn_min"),
        col("AREA_PPLTN_MAX").cast(IntegerType()).alias("ppltn_max"),
        col("FCST_YN").alias("fcst_yn")
    ) \
    .filter(col("ppltn_time").isNotNull()) # 이상값 제거 (기준 시간이 없는 데이터 제외)


    # (테이블 2) 1:N 예측 데이터 (city_live_ppltn_forecast) 준비
    # `explode` 함수로 FCST_PPLTN 배열을 여러 개의 행으로 펼칩니다.
forecast_df = parsed_ppltn_df \
    .filter(col("FCST_YN") == 'Y') \
    .select(
        "area_nm",
        to_timestamp(col("PPLTN_TIME"), "yyyy-MM-dd HH:mm").alias("base_ppltn_time"),
        # 점(.)을 사용해 객체 내부의 배열에 접근한 뒤 explode
        explode(col("FCST_PPLTN.FCST_PPLTN")).alias("fcst_item")
    ) \
    .select(
        "area_nm",
        "base_ppltn_time",
        to_timestamp(col("fcst_item.FCST_TIME"), "yyyy-MM-dd HH:mm").alias("fcst_time"),
        col("fcst_item.FCST_CONGEST_LVL").alias("fcst_congest_lvl"),
        col("fcst_item.FCST_PPLTN_MIN").cast(IntegerType()).alias("fcst_min"),
        col("fcst_item.FCST_PPLTN_MAX").cast(IntegerType()).alias("fcst_max")
    ) \
    .filter(
        (col("fcst_time").isNotNull()) & \
        (col("fcst_min") >= 0) & \
        (col("fcst_min") <= col("fcst_max"))
    )


    # 두 테이블에 대한 DB Write 함수 정의
def write_proc_to_postgres(df, epoch_id):
    df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "city_live_ppltn_proc") \
      .mode("append") \
      .save()

def write_forecast_to_postgres(df, epoch_id):
    
    if df.rdd.isEmpty():
        return
    
    df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "city_live_ppltn_forecast") \
      .mode("append") \
      .save()

    # 두 개의 새로운 스트림 시작
query_ppltn_proc = proc_df.writeStream \
    .outputMode("append") \
    .foreachBatch(write_proc_to_postgres) \
    .start()

query_ppltn_forecast = forecast_df.writeStream \
    .outputMode("append") \
    .foreachBatch(write_forecast_to_postgres) \
    .start()

# --- 2-2. city_data(city_data_raw)의 road_traffic_stts (AVG_ROAD_DATA) 스트림 --------

    # 스키마 정의
    # 가장 안쪽 데이터 (AVG_ROAD_DATA)
schema_avg_road_data = StructType([
    StructField("ROAD_MSG", StringType(), True),
    StructField("ROAD_TRAFFIC_IDX", StringType(), True),
    StructField("ROAD_TRAFFIC_SPD", StringType(), True),
    StructField("ROAD_TRAFFIC_TIME", StringType(), True)
])

schema_road_raw = StructType([
    StructField("AVG_ROAD_DATA", schema_avg_road_data, True)
])

    # 파싱 및 데이터 추출
parsed_road_df = parsed_stream_df_city_data \
    .filter(col("road_traffic_stts").isNotNull()) \
    .select(
        col("area_nm"),
        col("timestamp").alias("ingest_timestamp"),
        from_json(col("road_traffic_stts"), schema_road_raw).alias("road_data_outer")
    ) \
    .select(
        "area_nm",
        "ingest_timestamp",
        col("road_data_outer.AVG_ROAD_DATA.*") 
    )

    # 타입 변환 및 컬럼 매핑 (city_live_road_traffic_avg 테이블 구조에 맞춤)
road_proc_df = parsed_road_df \
    .select(
        col("area_nm"),
        col("ROAD_MSG").alias("road_msg"),
        col("ROAD_TRAFFIC_IDX").alias("road_traffic_idx"),
        col("ROAD_TRAFFIC_SPD").cast(IntegerType()).alias("road_traffic_spd"),
        to_timestamp(col("ROAD_TRAFFIC_TIME"), "yyyy-MM-dd HH:mm").alias("road_traffic_time"),
        col("ingest_timestamp")
    ) \
    .filter(col("road_traffic_time").isNotNull())

    # DB 적재 함수 정의
def write_road_avg_to_postgres(df, epoch_id):
    if df.rdd.isEmpty():
        return
        
    df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "city_road_traffic_stts_avg") \
      .mode("append") \
      .save()

    # 스트림 시작
query_road_avg = road_proc_df.writeStream \
    .outputMode("append") \
    .foreachBatch(write_road_avg_to_postgres) \
    .start()

# --- 2-3. city_data (city_data_raw)의 sub_stts 스트림 --------

    # SUB_DETAIL 배열 내부의 개별 도착 정보 스키마
schema_sub_detail_item = StructType([
    StructField("SUB_ROUTE_NM", StringType(), True),
    StructField("SUB_LINE", StringType(), True),
    StructField("SUB_ARMG1", StringType(), True),
    StructField("SUB_ARMG2", StringType(), True),
])

    # SUB_DETAIL 부모 객체 스키마
schema_sub_detail_parent = StructType([
    StructField("SUB_DETAIL", ArrayType(schema_sub_detail_item), True)
])

    # 역 정보 스키마 (SUB_STTS 배열의 각 항목)
schema_sub_station = StructType([
    StructField("SUB_STN_NM", StringType(), True),
    StructField("SUB_STN_LINE", StringType(), True),
    StructField("SUB_DETAIL", schema_sub_detail_parent, True)
])

    # 최상위 SUB_STTS 스키마
schema_sub_stts_outer = StructType([
    StructField("SUB_STTS", ArrayType(schema_sub_station), True)
])

    # city_data_raw 스트림에서 sub_stts 필드를 가져와 파싱
parsed_subway_df = parsed_stream_df_city_data \
    .filter(col("sub_stts").isNotNull()) \
    .select(
        col("area_nm"),
        col("timestamp").alias("ingest_timestamp"),
        from_json(col("sub_stts"), schema_sub_stts_outer).alias("subway_data_outer")
    ) \
    .select(
        "area_nm",
        "ingest_timestamp",
        explode(col("subway_data_outer.SUB_STTS")).alias("station")
    ) \
    .select(
        "area_nm",
        "ingest_timestamp",
        col("station.SUB_STN_NM").alias("station_nm"),
        col("station.SUB_STN_LINE").alias("line_num"),
        explode(col("station.SUB_DETAIL.SUB_DETAIL")).alias("detail")
    ) \
    .select(
        "area_nm",
        "station_nm",
        "line_num",
        col("detail.SUB_ROUTE_NM").alias("train_line_nm"),
        col("detail.SUB_ARMG1").alias("arrival_msg_1"),
        col("detail.SUB_ARMG2").alias("arrival_msg_2"),
        # 타임스탬프를 초 단위로 truncate - 갱신 시각 통일
        date_trunc("second", to_timestamp(col("ingest_timestamp"))).alias("ingest_timestamp")
    )

    # 도착 데이터 필터링
subway_arrival_df = parsed_subway_df \
    .filter(
        (col("station_nm").isNotNull()) & \
        (col("line_num").isNotNull()) & \
        (col("train_line_nm").isNotNull())
    ) \
    .select(
        "area_nm",
        "station_nm",
        "line_num",
        "train_line_nm",
        "arrival_msg_1",
        "arrival_msg_2",
        "ingest_timestamp"
    )

    # 데이터베이스 쓰기 함수
def write_subway_arrival_to_postgres(df, epoch_id):
    
    if df.rdd.isEmpty(): 
        return

    # 배치 내 중복 제거: 같은 키의 가장 최신 timestamp만 유지
    from pyspark.sql.window import Window
    from pyspark.sql.functions import row_number

    window_spec = Window.partitionBy("area_nm", "station_nm", "line_num", "train_line_nm").orderBy(col("ingest_timestamp").desc())
    dedup_df = df.withColumn("row_num", row_number().over(window_spec)) \
                 .filter(col("row_num") == 1) \
                 .drop("row_num")

    # DB에 저장 (append mode)
    dedup_df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "subway_arrival_proc") \
      .mode("append") \
      .save()

    # 스트림 시작
query_subway_arrival = subway_arrival_df.writeStream \
    .outputMode("append") \
    .foreachBatch(write_subway_arrival_to_postgres) \
    .start()

# --- 2-4. city_data (city_data_raw)의 live_sub_ppltn 스트림 ------------------

    # LIVE_SUB_PPLTN JSON 스키마 정의 (5분 데이터만)
schema_sub_ppltn = StructType([
    StructField("SUB_5WTHN_GTON_PPLTN_MIN", StringType(), True),
    StructField("SUB_5WTHN_GTON_PPLTN_MAX", StringType(), True),
    StructField("SUB_5WTHN_GTOFF_PPLTN_MIN", StringType(), True),
    StructField("SUB_5WTHN_GTOFF_PPLTN_MAX", StringType(), True),
    StructField("SUB_STN_CNT", StringType(), True),
    StructField("SUB_STN_TIME", StringType(), True)
])

    # city_data_raw 스트림에서 live_sub_ppltn 필드를 가져와 파싱
parsed_sub_ppltn_df = parsed_stream_df_city_data \
    .filter(col("live_sub_ppltn").isNotNull()) \
    .select(
        col("area_nm"),
        col("timestamp").alias("ingest_timestamp"),
        from_json(col("live_sub_ppltn"), schema_sub_ppltn).alias("sub_ppltn_data")
    ) \
    .select(
        "area_nm",
        "ingest_timestamp",
        "sub_ppltn_data.*"
    )

    # subway_ppltn_raw 테이블에 저장할 데이터 준비 (5분 단위 원본 데이터)
subway_ppltn_raw_df = parsed_sub_ppltn_df \
    .select(
        "area_nm",
        to_timestamp(col("ingest_timestamp")).alias("data_time"),
        # 5분 이내 승하차 평균 데이터
        ((col("SUB_5WTHN_GTON_PPLTN_MIN").cast(IntegerType()) + col("SUB_5WTHN_GTON_PPLTN_MAX").cast(IntegerType())) / 2)
            .cast(IntegerType()).alias("gton_avg"),
        ((col("SUB_5WTHN_GTOFF_PPLTN_MIN").cast(IntegerType()) + col("SUB_5WTHN_GTOFF_PPLTN_MAX").cast(IntegerType())) / 2)
            .cast(IntegerType()).alias("gtoff_avg"),
        col("SUB_STN_CNT").cast(IntegerType()).alias("stn_cnt")
    ) \
    .filter(col("gton_avg").isNotNull())

    # 데이터베이스 쓰기 함수 (Raw 데이터만 저장)
def write_subway_ppltn_to_postgres(df, epoch_id):
    if df.rdd.isEmpty():
        return

    # Raw 데이터 저장 (중복 제거)
    from pyspark.sql.window import Window
    from pyspark.sql.functions import row_number

    window_spec = Window.partitionBy("area_nm", "data_time").orderBy(col("data_time").desc())
    dedup_raw_df = df.withColumn("row_num", row_number().over(window_spec)) \
                     .filter(col("row_num") == 1) \
                     .drop("row_num")

    dedup_raw_df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "subway_ppltn_raw") \
      .mode("append") \
      .save()

    # 집계는 PostgreSQL Trigger가 자동으로 처리합니다

# 5. 스트림 시작
query_subway_ppltn = subway_ppltn_raw_df.writeStream \
    .outputMode("append") \
    .foreachBatch(write_subway_ppltn_to_postgres) \
    .start()

# --- 2-5. city_data (city_data_raw)의 WEATHER_STTS 스트림 --------

    # 스키마 정의 - 예보 리스트 내부 아이템 (최하위 FCST24HOURS)
schema_weather_fcst_item = StructType([
    StructField("FCST_DT", StringType(), True),
    StructField("TEMP", StringType(), True),
    StructField("PRECIPITATION", StringType(), True),
    StructField("PRECPT_TYPE", StringType(), True),
    StructField("RAIN_CHANCE", StringType(), True),
])

    # WEATHER_STTS 전체 스키마 (껍데기 벗겨낸 내부 데이터용)
schema_weather_outer = StructType([
    StructField("WEATHER_TIME", StringType(), True),
    StructField("TEMP", StringType(), True),
    StructField("MAX_TEMP", StringType(), True),
    StructField("MIN_TEMP", StringType(), True),
    StructField("HUMIDITY", StringType(), True),
    StructField("WIND_DIRCT", StringType(), True),
    StructField("WIND_SPD", StringType(), True),
    StructField("PRECIPITATION", StringType(), True), 
    StructField("PRECPT_TYPE", StringType(), True),
    StructField("PCP_MSG", StringType(), True),
    StructField("AIR_IDX", StringType(), True),
    StructField("AIR_IDX_MAIN", StringType(), True)
])

    # 데이터 파싱
        # 1. 현황 데이터: get_json_object(..., "$.WEATHER_STTS")로 내부 껍데기 진입
        # 2. 예보 데이터: coalesce로 이중/단일 구조 모두 대응
prepared_weather_df = parsed_stream_df_city_data \
    .filter(col("weather_stts").isNotNull()) \
    .select(
        col("area_nm"),
        col("timestamp").alias("ingest_timestamp"),
        col("weather_stts"), # 원본 JSON 유지 (예보 추출용)
        # [핵심 수정] $.WEATHER_STTS 경로를 지정하여 내부 객체만 파싱
        from_json(
            get_json_object(col("weather_stts"), "$.WEATHER_STTS"), 
            schema_weather_outer
        ).alias("weather_data")
    )

    # (Table 1) 기상 현황 데이터 (city_weather_stts_proc) 처리
weather_proc_df = prepared_weather_df \
    .select(
        col("area_nm"),
        to_timestamp(col("weather_data.WEATHER_TIME"), "yyyy-MM-dd HH:mm").alias("weather_time"),
        col("weather_data.TEMP").cast(DoubleType()).alias("temp"),
        col("weather_data.MAX_TEMP").cast(DoubleType()).alias("max_temp"),
        col("weather_data.MIN_TEMP").cast(DoubleType()).alias("min_temp"),
        col("weather_data.HUMIDITY").cast(DoubleType()).alias("humidity"),
        col("weather_data.WIND_DIRCT").alias("wind_dirct"),
        col("weather_data.WIND_SPD").cast(DoubleType()).alias("wind_spd"),
        col("weather_data.PRECIPITATION").alias("precipitation"),
        col("weather_data.PRECPT_TYPE").alias("precpt_type"),
        col("weather_data.PCP_MSG").alias("pcp_msg"),
        col("weather_data.AIR_IDX").alias("air_idx"),
        col("weather_data.AIR_IDX_MAIN").alias("air_idx_main"),
        col("ingest_timestamp")
    ) \
    .filter(col("weather_time").isNotNull())

    # (Table 2) 기상 예보 데이터 (city_weather_stts_forecast) 처리
weather_forecast_raw_df = prepared_weather_df \
    .withColumn("fcst_json_str", 
        coalesce(
            get_json_object(col("weather_stts"), "$.WEATHER_STTS.FCST24HOURS.FCST24HOURS"),
            get_json_object(col("weather_stts"), "$.WEATHER_STTS.FCST24HOURS"),
            get_json_object(col("weather_stts"), "$.FCST24HOURS.FCST24HOURS")
        )
    ) \
    .filter(col("fcst_json_str").isNotNull()) \
    .select(
        col("area_nm"),
        col("ingest_timestamp"),
        from_json(col("fcst_json_str"), ArrayType(schema_weather_fcst_item)).alias("fcst_list")
    )

weather_forecast_df = weather_forecast_raw_df \
    .select(
        col("area_nm"),
        col("ingest_timestamp"),
        explode(col("fcst_list")).alias("fcst")
    ) \
    .select(
        col("area_nm"),
        to_timestamp(col("fcst.FCST_DT"), "yyyyMMddHHmm").alias("fcst_dt"),
        col("fcst.TEMP").cast(DoubleType()).alias("temp"),
        col("fcst.PRECIPITATION").alias("precipitation"),
        col("fcst.PRECPT_TYPE").alias("precpt_type"),
        col("fcst.RAIN_CHANCE").cast(IntegerType()).alias("rain_chance"),
        col("ingest_timestamp")
    ) \
    .filter(col("fcst_dt").isNotNull())

    # DB 저장 함수 정의
def write_weather_proc_to_postgres(df, epoch_id):
    if df.rdd.isEmpty():
        return
    
    # PK 중복 방지 (지역명 + 날씨시간)
    df.dropDuplicates(['area_nm', 'weather_time']).write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "city_weather_stts_proc") \
      .mode("append") \
      .save()

def write_weather_forecast_to_postgres(df, epoch_id):
    if df.rdd.isEmpty():
        return
        
    # PK 중복 방지 (지역명 + 예보시간)
    df.dropDuplicates(['area_nm', 'fcst_dt']).write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "city_weather_stts_forecast") \
      .mode("append") \
      .save()

    # 스트림 시작
query_weather_proc = weather_proc_df.writeStream \
    .outputMode("append") \
    .foreachBatch(write_weather_proc_to_postgres) \
    .start()

query_weather_forecast = weather_forecast_df.writeStream \
    .outputMode("append") \
    .foreachBatch(write_weather_forecast_to_postgres) \
    .start()










# ----------------------------------------------------
spark.streams.awaitAnyTermination()