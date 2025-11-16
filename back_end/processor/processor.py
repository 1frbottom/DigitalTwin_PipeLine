from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType, DecimalType



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

# --- 1. road_comm (traffic_data) 스트림 ---
# (기존과 동일, "잘되던 기준")
schema_road_comm = StructType([
    StructField("link_id", StringType(), True),
    StructField("avg_speed", DoubleType(), True),
    StructField("travel_time", IntegerType(), True),
    StructField("timestamp", DoubleType(), True)
])
stream_df_road_comm = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:29092") \
    .option("subscribe", "realtime-traffic") \
    .load()
parsed_stream_df_road_comm = stream_df_road_comm.select(from_json(col("value").cast("string"), schema_road_comm).alias("data")).select("data.*")

def write_to_postgres(df, epoch_id):
    df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "traffic_data") \
      .mode("append") \
      .save()

query = parsed_stream_df_road_comm.writeStream \
    .foreachBatch(write_to_postgres) \
    .start()

# --- 2. incident (traffic_incidents) 스트림 ---
# [수정] "잘되던 기준" (단순 append)으로 복원
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

# [수정] 'write_to_postgres' 함수를 복사하여 'dbtable'만 변경
def write_incident_to_postgres(df, epoch_id):
    df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "traffic_incidents") \
      .mode("append") \
      .save()

# [수정] Staging/psycopg2 로직 대신 단순 append 함수 사용
query_incident = parsed_incident_df.writeStream \
    .foreachBatch(write_incident_to_postgres) \
    .start()

# ----------------------------------------------------
spark.streams.awaitAnyTermination()