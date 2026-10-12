import UIKit
import Capacitor
import GameKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = NecroBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// 15 Eki: oyunun yerel servisleri (JS: Capacitor.Plugins.NecroServices). Game Center liderlik tabloları + iCloud anahtar-değer deposunda kayıt.
// Ücretli Apple Developer hesabında Game Center ve iCloud (Key-value storage) yetenekleri açılınca çalışır; yoksa çağrılar hata vermeden boş döner.
class NecroBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NecroServicesPlugin())
    }
}

@objc(NecroServicesPlugin)
public class NecroServicesPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "NecroServicesPlugin"
    public let jsName = "NecroServices"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "login", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboards", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cloudSave", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cloudLoad", returnType: CAPPluginReturnPromise)
    ]
    private var loginCall: CAPPluginCall?

    @objc func login(_ call: CAPPluginCall) {
        if GKLocalPlayer.local.isAuthenticated { call.resolve(["ok": true]); return }
        loginCall = call
        DispatchQueue.main.async {
            GKLocalPlayer.local.authenticateHandler = { [weak self] vc, _ in
                if let vc = vc { self?.bridge?.viewController?.present(vc, animated: true); return }
                let c = self?.loginCall; self?.loginCall = nil
                c?.resolve(["ok": GKLocalPlayer.local.isAuthenticated])
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated, let id = call.getString("id") else { call.resolve(["ok": false]); return }
        let score = call.getInt("score") ?? 0
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [id]) { err in
            call.resolve(["ok": err == nil])
        }
    }

    @objc func showLeaderboards(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated else { call.resolve(["ok": false]); return }
            let vc = GKGameCenterViewController(state: .leaderboards)
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve(["ok": true])
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }

    @objc func cloudSave(_ call: CAPPluginCall) {
        let kv = NSUbiquitousKeyValueStore.default
        kv.set(call.getString("data") ?? "", forKey: "necro_save")
        call.resolve(["ok": kv.synchronize()])
    }

    @objc func cloudLoad(_ call: CAPPluginCall) {
        let kv = NSUbiquitousKeyValueStore.default
        kv.synchronize()
        if let d = kv.string(forKey: "necro_save"), !d.isEmpty { call.resolve(["data": d]) } else { call.resolve([:]) }
    }
}
