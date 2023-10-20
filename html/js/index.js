var app = new Vue({
  el: '#app',
  mixins: [mainMixin],
  data: {
    multipleFiles: false,
    tagArrayPointer: 0,
    pastedText: `
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    One, two, three, four, five, six, seven, eight, nine, ten
    1st, 2nd, 3rd, 4th, 5th, 6th, 7th, 8th, 9th, 10th
    First, second, third, fourth, fifth, sixth, seventh, eighth, ninth, tenth
    John met Sally in London and they went to Piccadilly Circus together. 
    The ticket vendor asked John for $100.
    John said that he would like to pass unimpeded.
    He wondered if the ticket was subsidized.
    The ticket inspector contradicted him.
    Don't do that please.
    `,
    showAdvancedSettings: false,
    forms: {},
    tswk: 80,
    pwkr: 95,
    eslaLevel: 1300,
    screen: 'copypaste',
    myDropzone: null,
    processing: false,
    hasFiles: false,
    response: null,
    plainText: '',
    processMethod: 'merged',
    maxWords: {
      batched: 25000,
      merged: 5000
    },
    radio_steps: [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]
  },
  watch: {
    multipleFiles() {
      if (!this.multipleFiles) {
        this.processMethod = "merged";
      }
    },
    screen() {
      if (this.screen == 'copypaste') {
        this.processMethod = "merged";
      }
    },
    tagArrayPointer() {
      this.getClasses();
      this.forms = this.getForms();
      
    },
    eslaLevel() {
      this.getClasses();
      this.forms = this.getForms();
    },
    tswk() {
      this.getClasses();
      this.forms = this.getForms();
    },
    pwkr() {
      this.getClasses();
      this.forms = this.getForms();
    }
  },
  mounted() {

    var vm = this;

    Dropzone.autoDiscover = false;

    vm.myDropzone = new Dropzone("div#myDropzone", {
      url: "/file-upload.php",
      acceptedFiles: 'application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain',
      maxFilesize: 4,
      autoProcessQueue: false,
      addRemoveLinks: true,
      uploadMultiple: true,
      parallelUploads: 25,
      maxFiles: 25
    });

    vm.myDropzone.on("sending", function(file, xhr, formData) {
      formData.append("processMethod", vm.processMethod);
      vm.showLoadingModal();
    });

    vm.myDropzone.on("addedfile", file => {
      vm.hasFiles = true;
      vm.multipleFiles = vm.myDropzone.files.length > 1;
    });

    vm.myDropzone.on("removedfile", file => {
      vm.hasFiles = vm.myDropzone.files.length > 0;
      vm.multipleFiles = vm.myDropzone.files.length > 1;
    });

    vm.myDropzone.on("successmultiple", (file, response) => {
      vm.processing = false;

      vm.response = JSON.parse(response);
      vm.hideLoadingModal();
      if (vm.response.result == 'success') {
        vm.screen = 'results';
        vm.forms = vm.getForms();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          html: vm.response.message,
        })
      }
      vm.clearFiles();
    });

    tippy('.info-box')

  },
  created() {

  },
  methods: {
    downloadTable() {
      $("#data-table").table2csv();
    },
    getKnownWordsPercent() {
      var vm = this;
      var knownCount = 0,
        totalCount = 0,
        form = null;
      this.response.tags_array[this.tagArrayPointer].tags.filter(function(e) {
        return e.tag != "SYM";
      }).forEach(function(tag) {
        if (tag.esla_item) {
          form = vm.forms[tag.esla_item.headword];
        } else {
          form = null;
        }
        if (form) {
          totalCount++;
        }
        if (form && ['NUM', 'KNOWN', 'PART', 'PROPN'].includes(form.category)) {
          knownCount++;
        }
      })
      return Math.round(knownCount / totalCount * 100);
    },
    clearText() {
      this.pastedText = '';
    },
    processText() {
      var vm = this;
      vm.showLoadingModal();
      axios
        .post("/file-upload.php", {
          processMethod: "copypaste",
          pastedText: vm.pastedText
        })
        .then(function(response) {
          vm.hideLoadingModal();
          vm.response = response.data;
          if (vm.response.result == 'success') {
            vm.screen = 'results';
            vm.getClasses();
            vm.forms = vm.getForms();
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              html: vm.response.message,
            })
          }
        })
        .catch(function(error) {
          console.error(error);
        });
    },
    getForms() {
      var vm = this;
      var forms = {},
        found, tagClasses, category, form;
      this.response.tags_array[this.tagArrayPointer].tags.filter(function(tag) {
        return !['PUNCT', 'SYM', 'PART'].includes(tag.pos);
      }).forEach(function(tag, idx) {

        form = tag.word.toUpperCase();
        category="";
        
        if (tag.esla_item) {
          form = tag.esla_item.headword;
        }

        // Form is marked known
        if (['NUM', 'AUX'].includes(tag.pos) || tag.tswk >= vm.tswk) {
          category = "KNOWN";
        }

        // Tag is marked blue (proper noun)
        if (tag.pos == "PROPN") {
          category = "PROPER NOUN";
        }

        // Tag is marked purple (unknown academic)
        if (!category && tag.esla_item && tag.esla_item.awl) {
          category = "UNKNOWN ACADEMIC";
        }

        // Tag is marked red (unknown non-academic)
        if (!category && (!tag.esla_item || !tag.esla_item.awl)) {
          category = "UNKNOWN";
        }
        

        if (!forms[form]) {
          forms[form] = {
            count: 1,
            category: category,
            types: [{
              word: tag.word,
              count: 1
            }]
          };
        } else {
          forms[form].count++;
          found = forms[form].types.find(function(e) {
            return e.word == tag.word
          });
          if (!found) {
            forms[form].types.push({
              word: tag.word,
              count: 1
            })
          } else {
            found.count++;
          }
        }

      })
      return forms;
    },
    getClasses() {
      var vm = this;
      var nextTag, spaceAfter, green, blue, purple, red;
      vm.response.tags_array[vm.tagArrayPointer].tags.forEach(function(tag, i) {

        nextTag = vm.response.tags_array[vm.tagArrayPointer].tags[i + 1];
        spaceAfter = true;
        green = false;
        blue = false;
        purple = false;
        red = false;

        if (tag.esla_item) {
          tag.tswk = 100 - (100 * tag.esla_item[vm.eslaLevel]);
        } else {
          tag.tswk = 0;
        }

        // Space after tag
        if (nextTag) {
          if (["PUNCT"].includes(nextTag.pos)) {
            spaceAfter = false;
          }
          if (nextTag.word.includes("'")) {
            spaceAfter = false;
          }
        }
        if (tag.pos == "SYM") {
          spaceAfter = false;
        }

        // Tag is marked green (known)
        if (['NUM', 'PART', 'AUX', 'SYM', 'PUNCT'].includes(tag.pos) || tag.tswk >= vm.tswk) {
          green = true;
        }

        // Tag is marked blue (proper noun)
        if (tag.pos == "PROPN") {
          blue = true;
        }

        // Tag is marked purple (unknown academic)
        if (!green && !blue && tag.esla_item && tag.esla_item.awl) {
          purple = true;
        }

        // Tag is marked red (unknown non-academic)
        if (!green && !blue && (!tag.esla_item || !tag.esla_item.awl)) {
          red = true;
        }

        tag.classes = {
          'tag': true,
          'space-after': spaceAfter,
          'green': green,
          'blue': blue,
          'purple': purple,
          'red': red
        };
      });
    },
    clearFiles() {
      this.myDropzone.removeAllFiles();
    },
    processFiles() {
      this.processing = true;
      this.myDropzone.processQueue();
    }
  }
})