import { For } from "solid-js";
import { A } from "@solidjs/router";

interface Crumb {
  label: string;
  href?: string;
  icon?: string;
}

export default function Breadcrumb(props: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-secondary mb-4 -mt-1">
      <For each={props.items}>
        {(item, i) => (
          <>
            {i() > 0 && <span aria-hidden="true" class="text-ink-secondary/30">/</span>}
            {item.href ? (
              <A href={item.href} class="hover:text-ink-primary transition-colors">
                {item.icon && <span aria-hidden="true" class="mr-1">{item.icon}</span>}
                {item.label}
              </A>
            ) : (
              <span class="text-ink-primary font-medium">
                {item.icon && <span aria-hidden="true" class="mr-1">{item.icon}</span>}
                {item.label}
              </span>
            )}
          </>
        )}
      </For>
    </nav>
  );
}
