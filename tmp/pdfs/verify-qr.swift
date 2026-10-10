import Foundation
import Vision
import ImageIO
let url=URL(fileURLWithPath:CommandLine.arguments[1])
let expected=try String(contentsOfFile:CommandLine.arguments[2],encoding:.utf8)
let request=VNDetectBarcodesRequest()
request.symbologies=[.qr]
try VNImageRequestHandler(url:url).perform([request])
let decoded=request.results?.first?.payloadStringValue
if decoded==expected {print("QR independently decoded: PASS")}else {fputs("QR decoding failed\n",stderr);exit(1)}
