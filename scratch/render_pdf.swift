import Foundation
import PDFKit
import AppKit

let pdfURL = URL(fileURLWithPath: "scratch/resolucion-test.pdf")
guard let doc = PDFDocument(url: pdfURL) else {
    print("Could not open PDF")
    exit(1)
}

for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { continue }
    let pageRect = page.bounds(for: .mediaBox)
    let scale: CGFloat = 2.0
    let size = CGSize(width: pageRect.width * scale, height: pageRect.height * scale)
    
    let image = NSImage(size: size)
    image.lockFocus()
    if let context = NSGraphicsContext.current?.cgContext {
        context.setFillColor(NSColor.white.cgColor)
        context.fill(CGRect(origin: .zero, size: size))
        context.scaleBy(x: scale, y: scale)
        page.draw(with: .mediaBox, to: context)
    }
    image.unlockFocus()
    
    if let tiffData = image.tiffRepresentation,
       let rep = NSBitmapImageRep(data: tiffData),
       let pngData = rep.representation(using: .png, properties: [:]) {
        let outURL = URL(fileURLWithPath: "scratch/resolucion-page-\(i+1).png")
        try pngData.write(to: outURL)
        print("Saved page \(i+1) to \(outURL.path)")
    }
}
