import AppKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let output = root.appendingPathComponent("assets/app-icons", isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)

func color(_ hex: UInt32, alpha: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xff) / 255,
            green: CGFloat((hex >> 8) & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255,
            alpha: alpha)
}

let sourceURL = root.appendingPathComponent("assets/moonrock-source.png")
guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
      let rock = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fatalError("Could not read the Moonrock asteroid artwork.")
}

let size = 1024
guard let context = CGContext(data: nil, width: size, height: size,
                              bitsPerComponent: 8, bytesPerRow: size * 4,
                              space: CGColorSpace(name: CGColorSpace.sRGB)!,
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    fatalError("Could not create the app icon canvas.")
}

context.setFillColor(color(0x151c35))
context.fill(CGRect(x: 0, y: 0, width: size, height: size))

let glowColors = [color(0x35354f, alpha: 0.62), color(0x151c35, alpha: 0)] as CFArray
let locations: [CGFloat] = [0, 1]
let gradient = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: glowColors, locations: locations)!
context.drawRadialGradient(gradient, startCenter: CGPoint(x: 520, y: 540), startRadius: 20,
                           endCenter: CGPoint(x: 520, y: 540), endRadius: 560, options: [])

context.saveGState()
context.translateBy(x: 512, y: 512)
context.rotate(by: -0.28)
let orbit = CGPath(ellipseIn: CGRect(x: -440, y: -280, width: 880, height: 560), transform: nil)
context.addPath(orbit)
context.setStrokeColor(color(0xc7a96e, alpha: 0.72))
context.setLineWidth(3)
context.strokePath()
context.restoreGState()

func star(_ center: CGPoint, radius: CGFloat) {
    let path = CGMutablePath()
    path.move(to: CGPoint(x: center.x, y: center.y + radius))
    path.addLine(to: CGPoint(x: center.x + radius * 0.16, y: center.y + radius * 0.16))
    path.addLine(to: CGPoint(x: center.x + radius, y: center.y))
    path.addLine(to: CGPoint(x: center.x + radius * 0.16, y: center.y - radius * 0.16))
    path.addLine(to: CGPoint(x: center.x, y: center.y - radius))
    path.addLine(to: CGPoint(x: center.x - radius * 0.16, y: center.y - radius * 0.16))
    path.addLine(to: CGPoint(x: center.x - radius, y: center.y))
    path.addLine(to: CGPoint(x: center.x - radius * 0.16, y: center.y + radius * 0.16))
    path.closeSubpath()
    context.addPath(path)
    context.setFillColor(color(0xe3ca91, alpha: 0.94))
    context.fillPath()
}

star(CGPoint(x: 815, y: 792), radius: 29)
context.setFillColor(color(0xe3ca91, alpha: 0.8))
context.fillEllipse(in: CGRect(x: 222, y: 748, width: 8, height: 8))
context.fillEllipse(in: CGRect(x: 735, y: 270, width: 6, height: 6))

context.saveGState()
context.setShadow(offset: CGSize(width: 0, height: -12), blur: 24, color: color(0x080c18, alpha: 0.48))
context.draw(rock, in: CGRect(x: 100, y: 100, width: 824, height: 824))
context.restoreGState()

guard let master = context.makeImage() else { fatalError("Could not render the app icon.") }

func writePNG(_ image: CGImage, name: String) throws {
    let url = output.appendingPathComponent(name)
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        fatalError("Could not write \(name).")
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Could not finish \(name).") }
}

for edge in [512, 192, 180, 32] {
    guard let thumb = CGContext(data: nil, width: edge, height: edge, bitsPerComponent: 8,
                               bytesPerRow: edge * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                               bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
        fatalError("Could not create the \(edge)px icon.")
    }
    thumb.interpolationQuality = .high
    thumb.draw(master, in: CGRect(x: 0, y: 0, width: edge, height: edge))
    try writePNG(thumb.makeImage()!, name: "moonrock-\(edge).png")
}
try writePNG(master, name: "moonrock-1024.png")
print("Rendered Moonrock app icons to \(output.path)")
