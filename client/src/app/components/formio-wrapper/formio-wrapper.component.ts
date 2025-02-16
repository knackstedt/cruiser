import { Component, ElementRef, EventEmitter, Input, Output, SimpleChange, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { Formio } from 'formiojs/dist/formio.form.min.js';


@Component({
    selector: 'app-formio-wrapper',
    template: '',
    styleUrl: './formio-wrapper.component.scss',
    standalone: true,
    host: {
        class: "formio"
    }
})
export class FormioWrapperComponent {


    @Input() formSchema = {};
    @Input() formOptions = {};

    @Input() data = {};
    @Output() dataChange = new EventEmitter<Object>();

    isDirty = false;


    private form: any;
    private hasRendered = false;

    constructor(
        private readonly elementRef: ElementRef
    ) { }

    ngAfterViewInit() {
        this.hasRendered = true;
        this.resetForm();
    }

    ngOnChanges(changes: SimpleChanges) {
        this.resetForm();
    }

    ngOnDestroy() {
        this.form?.destroy();
        this.form?.clear();
    }

    resetForm() {
        if (!this.hasRendered || !this.formSchema || !this.formSchema['components']) return;
        this.ngOnDestroy();

        Formio.createForm(
            this.elementRef.nativeElement,
            this.formSchema
        ).then(form => {
            this.form = form;
            const formInitializeTime = new Date().getTime();

            // Set the previous form submission
            form.submission = { data: this.data };

            form.on('change', changed => {
                // Wait 1 second before detecting if the form is dirty.
                if (changed.changed != undefined && (new Date().getTime() - formInitializeTime > 1000)) {
                    this.isDirty = true;
                }

                // If the form is valid, update the object.
                if (changed.isValid) {
                    Object.assign(this.data, changed.data);
                    this.dataChange.emit(this.data);
                }
            });

            form.on('error', errors => {
                // this.toaster.warn("Invalid Submission", errors);
                console.error("Form Error:", errors);
            });
        })
    }
}
