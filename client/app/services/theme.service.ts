import { Directive, ElementRef, Injectable, Input, ViewContainerRef } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

type AppTheme = "light" | "dark";

@Injectable({
    providedIn: 'root'
})
export class ThemeService extends BehaviorSubject<AppTheme> {

    constructor(
        private sanitizer: DomSanitizer
    ) {
        super("dark");

        this.subscribe(t => {
            document.body.classList.remove("dark");
            document.body.classList.remove("light");
            document.body.classList.add(t);
        })
    }

    public setTheme(t: AppTheme) {
        this.next(t);
    }


}


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
