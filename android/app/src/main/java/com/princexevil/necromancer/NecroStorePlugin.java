package com.princexevil.necromancer;

import android.app.Activity;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.Collections;
import java.util.List;

// 21 Eki 2026: mağaza sürümünün para tarafı (Android). Oyun (game.js) bunu window.NativeIAP / window.NativeAds üzerinden kullanır.
// - Google Play Billing 8: tek seferlik "mortimer_hazine" (tam oyun). buy, restore (yeniden kurulumda), price (Play'in yerel fiyatı).
//   Satın alma onaylanır (acknowledge); onaylanmazsa Play 3 gün sonra parayı iade eder.
// - AdMob ödüllü reklam: showRewarded → { ok: ödül kazanıldı mı }. Reklam kimlikleri res/values/strings.xml (admob_app_id, admob_rewarded);
//   şimdilik Google'ın herkese açık TEST kimlikleri, AdMob hesabı açılınca gerçekleriyle değişir.
// - UMP: Avrupa'da (GDPR) reklamdan önce Google'ın onay penceresi; onay yoksa reklam istenmez.
@CapacitorPlugin(name = "NecroStore")
public class NecroStorePlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billing;
    private ProductDetails product;
    private PluginCall buyCall;
    private RewardedAd rewarded;
    private boolean adsReady = false, adLoading = false;

    @Override
    public void load() {
        billing = BillingClient.newBuilder(getContext()).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
        billing.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult r) { if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) queryProduct(null); }
            @Override public void onBillingServiceDisconnected() { }
        });
    }

    private String productId() { return getContext().getString(R.string.iap_full_game); }

    private void queryProduct(Runnable then) {
        QueryProductDetailsParams p = QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(
            QueryProductDetailsParams.Product.newBuilder().setProductId(productId()).setProductType(BillingClient.ProductType.INAPP).build())).build();
        billing.queryProductDetailsAsync(p, (r, res) -> {
            List<ProductDetails> L = res.getProductDetailsList();
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && L != null && !L.isEmpty()) product = L.get(0);
            if (then != null) then.run();
        });
    }

    @PluginMethod
    public void price(PluginCall call) {
        JSObject o = new JSObject();
        if (product != null && product.getOneTimePurchaseOfferDetails() != null) o.put("price", product.getOneTimePurchaseOfferDetails().getFormattedPrice());
        call.resolve(o);
    }

    @PluginMethod
    public void buy(PluginCall call) {
        if (buyCall != null) { call.reject("busy"); return; }
        Runnable go = () -> {
            if (product == null) { call.reject("product"); return; }
            Activity a = getActivity();
            BillingFlowParams f = BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(
                BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).build())).build();
            buyCall = call;
            a.runOnUiThread(() -> {
                BillingResult r = billing.launchBillingFlow(a, f);
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) { PluginCall c = buyCall; buyCall = null; if (c != null) resolveOk(c, false); }
            });
        };
        if (product == null) queryProduct(go); else go.run();
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult r, List<Purchase> purchases) {
        PluginCall c = buyCall; buyCall = null;
        boolean ok = false;
        if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) for (Purchase p : purchases) ok |= handle(p);
        else if (r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) ok = true;
        if (c != null) resolveOk(c, ok);
    }

    // satın alındıysa onayla; bekleyen (ör. nakit ödeme) satın almada oyun açılmaz, ödeme gelince restore ya da sonraki açılışta açılır
    private boolean handle(Purchase p) {
        if (!p.getProducts().contains(productId()) || p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return false;
        if (!p.isAcknowledged()) billing.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), res -> { });
        return true;
    }

    @PluginMethod
    public void restore(PluginCall call) {
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (r, list) -> {
            boolean ok = false;
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) for (Purchase p : list) ok |= handle(p);
            resolveOk(call, ok);
        });
    }

    private void resolveOk(PluginCall c, boolean ok) { JSObject o = new JSObject(); o.put("ok", ok); c.resolve(o); }

    // ---- reklam ----
    @PluginMethod
    public void initAds(PluginCall call) {
        Activity a = getActivity();
        ConsentInformation ci = UserMessagingPlatform.getConsentInformation(a);
        a.runOnUiThread(() -> ci.requestConsentInfoUpdate(a, new ConsentRequestParameters.Builder().build(),
            () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(a, err -> startAds(ci, call)),
            err -> startAds(ci, call)));
    }

    private void startAds(ConsentInformation ci, PluginCall call) {
        if (!ci.canRequestAds()) { resolveOk(call, false); return; }
        if (!adsReady) { adsReady = true; MobileAds.initialize(getContext(), s -> loadRewarded()); }
        resolveOk(call, true);
    }

    private void loadRewarded() {
        if (adLoading || rewarded != null) return; adLoading = true;
        Activity a = getActivity();
        a.runOnUiThread(() -> RewardedAd.load(a, a.getString(R.string.admob_rewarded), new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull RewardedAd ad) { rewarded = ad; adLoading = false; }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { rewarded = null; adLoading = false; }
        }));
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        Activity a = getActivity();
        if (rewarded == null) { loadRewarded(); resolveOk(call, false); return; }
        RewardedAd ad = rewarded; rewarded = null;
        final boolean[] earned = { false };
        a.runOnUiThread(() -> {
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override public void onAdDismissedFullScreenContent() { resolveOk(call, earned[0]); loadRewarded(); }
                @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) { resolveOk(call, false); loadRewarded(); }
            });
            ad.show(a, item -> earned[0] = true);
        });
    }

    // reklam onayını değiştirme (gizlilik seçenekleri): Ayarlar'dan açılır
    @PluginMethod
    public void privacyOptions(PluginCall call) {
        Activity a = getActivity();
        a.runOnUiThread(() -> UserMessagingPlatform.showPrivacyOptionsForm(a, err -> resolveOk(call, err == null)));
    }

    @PluginMethod
    public void privacyRequired(PluginCall call) {
        JSObject o = new JSObject();
        o.put("required", UserMessagingPlatform.getConsentInformation(getActivity()).getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
        call.resolve(o);
    }
}
