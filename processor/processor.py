# processor.py (수정 완료)
from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType

spark = SparkSession.builder \
    .appName("TrafficDataProcessor") \
    .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.1") \
    .getOrCreate() # 1. Spark 버전에 맞게 라이브러리 버전 수정 (3.3.0 -> 3.5.1)

schema = StructType([
    StructField("vehicle_count", IntegerType(), True),
    StructField("timestamp", DoubleType(), True)
])

kafka_stream_df = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:29092") \
    .option("subscribe", "traffic-data") \
    .load() # 2. 카프카 접속 주소 수정 (localhost:9092 -> kafka:29092)

parsed_stream_df = kafka_stream_df.select(from_json(col("value").cast("string"), schema).alias("data")).select("data.*")

query = parsed_stream_df.writeStream \
    .outputMode("append") \
    .format("console") \
    .start()

query.awaitTermination()