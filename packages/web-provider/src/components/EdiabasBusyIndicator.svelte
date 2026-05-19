<script lang="ts">
  /**
   * Amber pulse that lights up whenever the EDIABAS bridge has any
   * `INPAapi*` async call in flight (init / end / job / fsLesen /
   * fsLesen2). Mirrors `LiveIndicator` in structure but tracks the
   * provider's `busy:changed` event instead of `state.screenCyclic`.
   *
   * Why a separate indicator: the green LiveIndicator answers "is the
   * screen on a refresh cycle?" — a screen-level signal that says
   * roughly nothing once a script is past its first paint. This one
   * answers "is the script currently talking to the ECU?" — the
   * background-I/O signal that actually changes minute-to-minute on a
   * typical session (every job pulse blips it, fault-storage reads
   * keep it lit for seconds).
   *
   * Pure CSS keyframe pulse + amber palette so it reads as
   * "transient work" vs. LiveIndicator's "live-data heartbeat".
   */

  import type { IEdiabasProvider } from "@emdzej/inpax-interfaces";

  type Props = { ediabas: IEdiabasProvider | null | undefined };
  const { ediabas }: Props = $props();

  let busy = $state(false);

  $effect(() => {
    const provider = ediabas;
    if (!provider) {
      busy = false;
      return;
    }
    // Initial sync: the indicator may mount after some calls already
    // started (e.g. INPAapiInit kicked off before the canvas attached).
    // `isBusy` is a relatively new addition to IEdiabasProvider —
    // tolerate older bundled provider builds (stale `dist/`, mismatched
    // workspace versions during dev, etc.) by feature-checking rather
    // than calling unconditionally.
    busy =
      typeof (provider as { isBusy?: () => boolean }).isBusy === "function"
        ? (provider as { isBusy: () => boolean }).isBusy()
        : false;
    const onBusy = (event: { busy: boolean; inFlight: number }) => {
      busy = event.busy;
    };
    provider.on("busy:changed", onBusy);
    return () => {
      provider.off("busy:changed", onBusy);
    };
  });
</script>

{#if busy}
  <span
    class="pointer-events-auto absolute right-7 top-2 block h-2 w-2 animate-pulse rounded-full bg-amber-500 shadow-sm"
    title="ECU communication — the script is currently running a diagnostic job, reading fault storage, or otherwise waiting on the EDIABAS bridge. This is normal during data refreshes."
    aria-label="Background processing — EDIABAS job in progress"
    role="status"
  ></span>
{/if}
