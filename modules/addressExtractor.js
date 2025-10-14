// Save this file as: modules/addressExtractor.js

const translator = require('./translator');

class AddressExtractor {
  constructor() {
    // Odia field labels mapping
    this.odiaFieldLabels = {
      'ମୁଖ୍ୟ ସଚିବ': 'polling_station_name',
      'ଶ୍ରୀମତୀ': 'polling_station_name',
      'ତାଙ୍କଯର': 'locality',
      'ଆମ': 'village',
      'ପଞ୍ଚାୟତ': 'panchayat',
      'ବ୍ଲକ': 'block',
      'ସବଡିଭିଜନ': 'subdivision',
      'ଜିଲ୍ଲା': 'district',
      'ପିନ': 'pincode',
      'ଗ୍ରାମ': 'village',
      'ଥାନା': 'police_station'
    };

    // English field labels mapping
    this.englishFieldLabels = {
      'Polling Station': 'polling_station_name',
      'Location': 'locality',
      'Village': 'village',
      'Panchayat': 'panchayat',
      'GP': 'panchayat',
      'Block': 'block',
      'Tehsil': 'block',
      'Sub-Division': 'subdivision',
      'Subdivision': 'subdivision',
      'District': 'district',
      'PIN': 'pincode',
      'Pincode': 'pincode',
      'Police Station': 'police_station',
      'PS': 'police_station'
    };
  }

  async extractAddressFromText(text, lines) {
    console.log('📍 Extracting address information...');

    const address = {
      buildingName: '',
      locality: '',
      village: '',
      panchayat: '',
      block: '',
      subdivision: '',
      district: '',
      policeStation: '',
      state: 'Odisha',
      pincode: ''
    };

    // 1. Extract from colon-separated format
    const colonFormatAddress = this.extractColonFormat(lines);
    Object.assign(address, colonFormatAddress);

    // 2. Extract from labeled sections
    const labeledAddress = await this.extractLabeledFormat(lines);
    Object.assign(address, { ...address, ...labeledAddress });

    // 3. Fallback extractors
    if (!address.district) address.district = this.extractDistrict(text, lines);
    if (!address.pincode) address.pincode = this.extractPincode(text);
    if (!address.block) address.block = await this.extractBlock(lines);
    if (!address.village) address.village = await this.extractVillage(lines);

    // Clean and validate
    return this.cleanAddress(address);
  }

  extractColonFormat(lines) {
    const address = {};
    for (const line of lines.slice(0, 50)) {
      if (!line.includes(':')) continue;
      const [label, value] = line.split(':').map(s => s.trim());
      if (!label || !value) continue;

      // Odia labels
      for (const [odiaLabel, field] of Object.entries(this.odiaFieldLabels)) {
        if (label.includes(odiaLabel)) {
          address[this.mapFieldName(field)] = value;
          console.log(`  Found ${field}: ${value}`);
        }
      }

      // English labels
      const labelLower = label.toLowerCase();
      for (const [engLabel, field] of Object.entries(this.englishFieldLabels)) {
        if (labelLower.includes(engLabel.toLowerCase())) {
          address[this.mapFieldName(field)] = value;
          console.log(`  Found ${field}: ${value}`);
        }
      }
    }
    return address;
  }

  async extractLabeledFormat(lines) {
    const address = {};
    const patterns = [
      { regex: /(?:ଜିଲ୍ଲା|District|Dist\.?)[\s:]*([A-Za-z\u0B00-\u0B7F]+)/i, field: 'district' },
      { regex: /(?:ବ୍ଲକ|Block|Tehsil)[\s:]*([A-Za-z\u0B00-\u0B7F\s]+?)(?:$|\n|,)/i, field: 'block' },
      { regex: /(?:ଗ୍ରାମ|ଆମ|Village)[\s:]*([A-Za-z\u0B00-\u0B7F]+)/i, field: 'village' },
      { regex: /(?:ପଞ୍ଚାୟତ|Panchayat|GP)[\s:]*([A-Za-z\u0B00-\u0B7F]+)/i, field: 'panchayat' },
      { regex: /(?:ସବଡିଭିଜନ|Sub[-\s]?Division|Subdivision)[\s:]*([A-Za-z\u0B00-\u0B7F\s]+?)(?:$|\n)/i, field: 'subdivision' },
      { regex: /(?:ପିନ|PIN|Pincode)[\s:]*(\d{6})/i, field: 'pincode' }
    ];

    for (const line of lines.slice(0, 50)) {
      for (const { regex, field } of patterns) {
        const match = line.match(regex);
        if (match) {
          let value = match[1].trim();
          if (/[\u0B00-\u0B7F]/.test(value)) {
            try {
              value = await translator.translateToEnglish(value);
            } catch (error) {
              console.log(`  Translation skipped for: ${value}`);
            }
          }
          address[field] = value;
        }
      }
    }
    return address;
  }

  mapFieldName(field) {
    const mapping = {
      'polling_station_name': 'buildingName',
      'locality': 'locality',
      'village': 'village',
      'panchayat': 'panchayat',
      'block': 'block',
      'subdivision': 'subdivision',
      'district': 'district',
      'pincode': 'pincode',
      'police_station': 'policeStation'
    };
    return mapping[field] || field;
  }

  extractDistrict(text, lines) {
    const districts = [
      'Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak',
      'Boudh', 'Cuttack', 'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam',
      'Jagatsinghpur', 'Jajpur', 'Jharsuguda', 'Kalahandi', 'Kandhamal',
      'Kendrapara', 'Kendujhar', 'Khordha', 'Koraput', 'Malkangiri',
      'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Puri',
      'Rayagada', 'Sambalpur', 'Subarnapur', 'Sundargarh', 'Cuttack',
      'Kataka', 'କଟକ'
    ];
    for (const district of districts) {
      if (text.includes(district)) {
        return district;
      }
    }
    const districtPattern = /(?:ଜିଲ୍ଲା|District)[\s:]*([A-Za-z\u0B00-\u0B7F]+)/i;
    const match = text.match(districtPattern);
    if (match) {
      return match[1].trim();
    }
    return '';
  }

  extractPincode(text) {
    const pincodes = text.match(/\b\d{6}\b/g);
    if (!pincodes) return '';
    for (const pin of pincodes) {
      if (['75', '76', '77'].includes(pin.substring(0, 2))) {
        return pin;
      }
    }
    return pincodes[0] || '';
  }

  async extractBlock(lines) {
    const blockPatterns = [
      /(?:ବ୍ଲକ|Block)[\s:]*([A-Za-z\u0B00-\u0B7F\s]+?)(?:\n|$|,)/i,
      /(?:Tehsil|ତହସିଲ)[\s:]*([A-Za-z\u0B00-\u0B7F\s]+?)(?:\n|$)/i
    ];
    for (const line of lines.slice(0, 40)) {
      for (const pattern of blockPatterns) {
        const match = line.match(pattern);
        if (match) {
          let block = match[1].trim();
          if (/[\u0B00-\u0B7F]/.test(block)) {
            try {
              block = await translator.translateToEnglish(block);
            } catch (error) {
              console.log(`  Translation skipped for block: ${block}`);
            }
          }
          return block;
        }
      }
    }
    return '';
  }

  async extractVillage(lines) {
    const villagePatterns = [
      /(?:ଗ୍ରାମ|Village|ଆମ)[\s:]*([A-Za-z\u0B00-\u0B7F]+)/i,
      /(?:Town|ସହର)[\s:]*([A-Za-z\u0B00-\u0B7F]+)/i
    ];
    for (const line of lines.slice(0, 40)) {
      for (const pattern of villagePatterns) {
        const match = line.match(pattern);
        if (match) {
          let village = match[1].trim();
          if (/[\u0B00-\u0B7F]/.test(village)) {
            try {
              village = await translator.translateToEnglish(village);
            } catch (error) {
              console.log(`  Translation skipped for village: ${village}`);
            }
          }
          return village;
        }
      }
    }
    return '';
  }

  cleanAddress(address) {
    const cleaned = {};
    for (const [key, value] of Object.entries(address)) {
      if (value && typeof value === 'string') {
        let cleanValue = value
          .replace(/\s+/g, ' ')
          .replace(/[^\w\s\u0B00-\u0B7F-]/g, '')
          .trim();
        if (cleanValue && cleanValue.length > 0) {
          cleaned[key] = cleanValue;
        }
      }
    }
    return cleaned;
  }

  formatAddress(address) {
    const parts = [];
    if (address.buildingName) parts.push(address.buildingName);
    if (address.locality) parts.push(address.locality);
    if (address.village) parts.push(address.village);
    if (address.panchayat && address.panchayat !== address.village) parts.push(`GP: ${address.panchayat}`);
    if (address.block) parts.push(`Block: ${address.block}`);
    if (address.subdivision) parts.push(address.subdivision);
    if (address.district) parts.push(address.district);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);
    return parts.join(', ');
  }

  getStructuredAddress(address) {
    return {
      line1: [address.buildingName, address.locality].filter(Boolean).join(', '),
      line2: [address.village, address.panchayat].filter(Boolean).join(', '),
      line3: [address.block, address.subdivision].filter(Boolean).join(', '),
      city: address.district,
      state: address.state,
      pincode: address.pincode,
      formatted: this.formatAddress(address)
    };
  }
}

module.exports = new AddressExtractor();
