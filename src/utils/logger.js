const winston = require("winston");
require("winston-daily-rotate-file");

const { combine, timestamp, printf, colorize, json } = winston.format;

const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const extra = Object.keys(meta).length ? JSON.stringify(meta) : "";
  return `${timestamp} [${level}] ${message} ${extra}`;
});

const fileTransport = new winston.transports.DailyRotateFile({
  filename: "logs/trustgate-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), json()),
  transports: [
    fileTransport,
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: "HH:mm:ss" }), consoleFormat),
    }),
  ],
});

module.exports = logger;
