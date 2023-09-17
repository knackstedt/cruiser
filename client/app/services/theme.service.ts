import { Directive, ElementRef, Input } from '@angular/core';
import { ThemeService } from '@dotglitch/ngx-common';

@Directive({
  selector: 'img[icon]',
  standalone: true
})
export class ThemedIconDirective {

    @Input('icon') icon: string;

    mode: "dark" | "light" = "dark";
    private _s;
    constructor(
        private element: ElementRef,
        private theme: ThemeService
    ) {
    }

    ngOnInit() {

        this._s = this.theme.subscribe(t => {
            this.mode = t;
            this.updateSrc();
        })
    }

    updateSrc() {
        const img = this.element?.nativeElement as HTMLImageElement;
        img.src = `/assets/icons/${this.icon}-${this.mode}.svg`;
    }

    ngOnDestroy() {
        this._s.unsubscribe();
    }
}
